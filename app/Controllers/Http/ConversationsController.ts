import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import Database from '@ioc:Adonis/Lucid/Database';
import { base64, cuid } from '@ioc:Adonis/Core/Helpers';
import crypto from 'crypto';
import Key from 'App/Models/Key';
import Conversation from 'App/Models/Conversation';
import User from 'App/Models/User';
import Participant from 'App/Models/Participant';
import Message from 'App/Models/Message';
import StoreNewConversationValidator from 'App/Validators/StoreConversationValidator';
import Redis from '@ioc:Adonis/Addons/Redis';

export default class ConversationsController {
    /**
     *  NEW CONVERSATION
     *
     *  Create a new conversation with an user
     *
     *  @route POST /conversations/new
     */

    public async New({ response, request, auth }: HttpContextContract): Promise<void> {
        /**
         * Getting data and validating it
         */

        const { participantsWithoutCreator, content } = await request.validate(StoreNewConversationValidator);
        const participantsWithoutCreatorObject = participantsWithoutCreator.map((element) => {
            const splitStringArray = element.split('#');
            return {
                username: splitStringArray[0],
                tag: splitStringArray[1],
            };
        });

        const connectedUser = auth.user!;

        /**
         *  Creating id for conversation and message
         */

        const convId = cuid();
        const msgId = cuid();

        /**
         *  Ciphering the message with creating key and iv for aes-192-cbc
         */

        const key = crypto.randomBytes(24);
        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipheriv('aes-192-ctr', key, iv);
        let encryptedMsg = cipher.update(content, 'utf-8', 'hex');
        encryptedMsg += cipher.final('hex');

        /**
         *  We create an array for all participants of the conversation.
         */

        const participantsPayloadPromise = participantsWithoutCreatorObject.map(async (element) => {
            const participant = await User.query()
                .where('username', element.username)
                .andWhere('tag', element.tag)
                .select('id');

            /**
             *  We check if the participants are existing
             */
            if (participant.length === 0) {
                return response.badRequest({
                    status: 'Bad Request',
                    errors: `The user ${element.username}#${element.tag} doesn't exist`,
                });
            }
            const participantId = participant[0].id;

            /**
             *  If it's a 1:1 conversation, we check if that a conversations already exists (if so, we return an error)
             */
            if (participantsWithoutCreatorObject.length === 1) {
                const conversation_exists = await Conversation.query()
                    .whereHas('participants', (subquery) => subquery.where('user_id', auth.user!.id))
                    .andWhereHas('participants', (subquery) => subquery.where('user_id', participantId));

                if (conversation_exists.length >= 1) {
                    return response.conflict({
                        status: 'Conflict',
                        errors: 'There is already a conversation between these users',
                    });
                }
            }

            return { userId: participantId, conversationId: convId };
        });
        const participantsPayload = await Promise.all(participantsPayloadPromise);
        participantsPayload.push({
            userId: connectedUser.id,
            conversationId: convId,
        }); //Pushing into the array the user who created the conversation

        /**
         *  We create an array for keys of each participants.
         *  Keys are beeing ciphered by the public key of each participants so they are not the same in db.
         */

        const keysPayloadPromise = participantsWithoutCreatorObject.map(async (element) => {
            const participant = await User.query()
                .where('username', element.username)
                .andWhere('tag', element.tag)
                .select('public_key', 'id');
            const participantPublicKey = participant[0].publicKey;
            const participantId = participant[0].id;

            const keyEncrypted = crypto.publicEncrypt(Buffer.from(participantPublicKey), Buffer.from(key));

            return {
                conversationId: convId,
                ownerId: participantId,
                keyEncrypted: keyEncrypted.toString('base64'),
                iv: iv.toString('hex'),
            };
        });
        const keysPayload = await Promise.all(keysPayloadPromise);
        const connectedUserEncryptedKey = crypto.publicEncrypt(
            Buffer.from(connectedUser.publicKey),
            Buffer.from(key)
        );
        keysPayload.push({
            conversationId: convId,
            ownerId: connectedUser.id,
            keyEncrypted: connectedUserEncryptedKey.toString('base64'),
            iv: iv.toString('hex'),
        }); // Pushing into the array the user who created the conversation

        /**
         * We create an array for message's status of each participant
         */

        const messageStatutesPayloadPromise = participantsWithoutCreatorObject.map(async (element) => {
            const participant = await User.query()
                .where('username', element.username)
                .andWhere('tag', element.tag)
                .select('id');

            const participantId = participant[0].id;

            return {
                userId: participantId,
                read: false,
            };
        });
        const messageStatutesPayload = await Promise.all(messageStatutesPayloadPromise);
        messageStatutesPayload.push({
            userId: connectedUser.id,
            read: true,
        }); //Puhsing into the array the creator

        /**
         *  Preparing conversation and message payloads.
         */

        const convPayload = {
            id: convId,
            creatorId: connectedUser.id,
            firstMessageId: msgId,
        };

        const msgPayload = {
            id: msgId,
            authorId: connectedUser.id,
            conversationId: convId,
            content: encryptedMsg,
        };

        /**
         *  Inserting data into the database
         */

        const trx = await Database.transaction();
        try {
            await Conversation.create(convPayload, { client: trx });
            await (await Message.create(msgPayload, { client: trx }))
                .related('messageStatuses')
                .createMany(messageStatutesPayload);
            await Key.createMany(keysPayload, { client: trx });
            //@ts-ignore
            await Participant.createMany(participantsPayload, { client: trx });
            await trx.commit();
        } catch (e) {
            await trx.rollback();
            console.log(e);
            return response.internalServerError({
                status: 'Internal Server Error',
                errors: { message: 'Error at transaction' },
            });
        }

        //Everything 😀
        return response.created({ status: 'Created' });
    }

    /**
     *  GET CONVERSATION
     *
     *  Get 12 of your conversations from :offset and classed by time of last message sent.
     *  This route is not returning the messages of your conversations. If you want this, check /messages/get:conv_id? on MessagesController
     *
     *  @route GET  /conversations/get:offset?
     *
     */

    public async Get({
        request,
        response,
        auth,
        session,
    }: HttpContextContract): Promise<Array<object> | void> {
        /**
         * Getting data from the request and get private key
         */

        const userId = auth.user!.id;
        const { offset } = request.qs();
        const offsetInt = parseInt(offset);

        if (isNaN(offsetInt)) {
            return response.badRequest({
                status: 'Bad Request',
                errors: {
                    message: 'Offset parameter is missing or is invalid',
                },
            });
        }

        /**
         * Getting private key, if session auth : it is in sessions cookies, if token auth : it is in the meta of the token
         */

        let privateKey: string;
        const authorization_header = request.header('authorization');

        if (authorization_header !== undefined) {
            const parts = authorization_header.split(' ');
            const tokenParts = parts[1].split('.');

            const tokenId = base64.urlDecode(tokenParts[0]);
            const token = await Redis.get(`api:${tokenId}`);

            if (!token) {
                return;
            }

            const tokenObject = JSON.parse(token);
            privateKey = tokenObject.meta.privateKey;
        } else {
            privateKey = session.get('key');
        }

        /**
         * Getting conversations and keys data from the db
         */

        const userConversations = await Conversation.query()
            .preload('participants', (subquery) => subquery.select('user_id').whereNot('user_id', userId))
            .whereHas('participants', (subquery) => subquery.where('user_id', userId))
            .orderBy('updated_at', 'desc')
            .offset(offset)
            .limit(12);

        if (userConversations.length === 0) {
            return response.ok({ status: 'Ok', data: [] });
        }

        /**
         * Deciphering conversations, serializing them, and adding the username of the receiver
         */

        const userConversationsSerialized = userConversations.map((element) => element.serialize());

        const userConversationsMap = userConversationsSerialized.map(async (element) => {
            const convId = element.id;

            //Get the last message of each conversation
            const lastMessageConv = (
                await Message.query()
                    .where('conversation_id', element.id)
                    .preload('messageStatuses', (subquery) =>
                        subquery.select('read').where('user_id', userId)
                    )
                    .select('id', 'content', 'author_id', 'created_at')
                    .orderBy('created_at', 'desc')
                    .limit(1)
            )[0];

            //Decrypted AES key and get iv
            const { keyEncrypted, iv } = (
                await Key.query()
                    .where('conversation_id', convId)
                    .andWhere('owner_id', userId)
                    .select('key_encrypted', 'iv')
            )[0];
            const keyAES = crypto.privateDecrypt(
                Buffer.from(privateKey),
                Buffer.from(keyEncrypted, 'base64')
            );

            //Decrypt message
            const decipher = crypto.createDecipheriv('aes-192-ctr', keyAES, Buffer.from(iv, 'hex'));
            let decryptedMsg = decipher.update(lastMessageConv.content, 'hex', 'utf-8');
            decryptedMsg += decipher.final('utf-8');

            //Adding participant's username to participants key
            const participantsPromise = element.participants.map(async (elementBis) => {
                const participantId = elementBis.user_id;

                const { username, tag } = (
                    await User.query().where('id', participantId).select('username', 'tag')
                )[0];

                return {
                    user_id: participantId,
                    username,
                    tag,
                };
            });
            const participants = await Promise.all(participantsPromise);

            //Return element
            return {
                conversation_id: convId,
                participants,
                last_message: {
                    id: lastMessageConv.id,
                    author_id: lastMessageConv.authorId,
                    content: decryptedMsg,
                    read: lastMessageConv.messageStatuses[0].read,
                    created_at: lastMessageConv.createdAt,
                },
            };
        });

        const data = await Promise.all(userConversationsMap);

        //Everything 😀
        return response.status(200).json({ data: data, status: 'Ok' });
    }

    /**
     *  SEARCH CONVERSATION
     *
     *  Search your conversation by username of the receiver
     *
     *  @route GET  /conversations/search:query?&offset
     */

    public async Search({ request, response, auth, session }: HttpContextContract): Promise<void> {
        /**
         * Get data from request
         */

        const { query, offset } = request.qs();
        const offsetInt = parseInt(offset);
        const userId = auth.user!.id;

        if (query === undefined || isNaN(offsetInt)) {
            return response.badRequest({
                status: 'Bad Request',
                errors: { message: 'Some parameters are invalid or missing' },
            });
        }

        /**
         * Getting private key, if session auth : it is in sessions cookies, if token auth : it is in the meta of the token
         */

        let privateKey: string;
        const authorization_header = request.header('authorization');

        if (authorization_header !== undefined) {
            const parts = authorization_header.split(' ');
            const tokenParts = parts[1].split('.');

            const tokenId = base64.urlDecode(tokenParts[0]);
            const token = await Redis.get(`api:${tokenId}`);

            if (!token) {
                return;
            }

            const tokenObject = JSON.parse(token);
            privateKey = tokenObject.meta.privateKey;
        } else {
            privateKey = session.get('key');
        }

        const userConversationsId = await Conversation.query().whereHas('participants', (subQuery) => {
            subQuery.where('userId', userId);
        });

        /**
         * Retrieving conversations filtered by the query parameter and deciphering it
         */

        const dataPromise = userConversationsId.map(async (element) => {
            const conversationsWithoutLastMessages = await Participant.query()
                .where('conversation_id', element.id)
                .andWhereNot('user_id', userId)
                .whereHas('users', (subQuery) => subQuery.where('username', 'like', `${query}%`))
                .preload('conversations', (query) => query.orderBy('updated_at', 'desc'))
                .offset(offsetInt)
                .select('conversation_id', 'user_id')
                .distinct('conversation_id')
                .limit(12);

            const conversationsWithoutLastMessagesSerialized = conversationsWithoutLastMessages.map((conv) =>
                conv.serialize()
            );

            //Getting participant's username and tag
            const participantsPromise = conversationsWithoutLastMessagesSerialized.map(async (element) => {
                const participantId = element.user_id;
                const { username, tag } = (
                    await User.query().where('id', participantId).select('username', 'tag')
                )[0];

                return {
                    user_id: participantId,
                    username,
                    tag,
                };
            });
            const participants = await Promise.all(participantsPromise);

            //Getting last message and deciphering it
            const conversationsPromise = conversationsWithoutLastMessagesSerialized.map(async (element) => {
                const convId = element.conversation.id;

                //Get the last message of each conversation
                const lastMessageConv = (
                    await Message.query()
                        .where('conversation_id', convId)
                        .preload('messageStatuses', (subquery) =>
                            subquery.select('read').where('user_id', userId)
                        )
                        .select('id', 'content', 'author_id', 'created_at')
                        .orderBy('created_at', 'desc')
                        .limit(1)
                )[0];

                //Decrypt AES key and get iv
                const { keyEncrypted, iv } = (
                    await Key.query()
                        .where('conversation_id', convId)
                        .andWhere('owner_id', userId)
                        .select('key_encrypted', 'iv')
                )[0];
                const key_AES = crypto.privateDecrypt(
                    Buffer.from(privateKey),
                    Buffer.from(keyEncrypted, 'base64')
                );

                //Decrypted message
                const decipher = crypto.createDecipheriv('aes-192-ctr', key_AES, Buffer.from(iv, 'hex'));
                let decryptedMsg = decipher.update(lastMessageConv.content, 'hex', 'utf-8');
                decryptedMsg += decipher.final('utf-8');

                //Return element

                return {
                    conversation_id: convId,
                    participants,
                    last_message: {
                        id: lastMessageConv.id,
                        author_id: lastMessageConv.authorId,
                        content: decryptedMsg,
                        read: lastMessageConv.messageStatuses[0].read,
                        created_at: lastMessageConv.createdAt,
                    },
                };
            });

            const conversations = await Promise.all(conversationsPromise);
            return conversations;
        });

        //Promises...
        const data = await Promise.all(dataPromise);

        //Returning response
        return response.status(200).json({ status: 'Ok', data });
    }
}
