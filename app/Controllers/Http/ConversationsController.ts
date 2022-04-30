import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import Database from '@ioc:Adonis/Lucid/Database';
import { base64 } from '@ioc:Adonis/Core/Helpers';
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
     *
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

        const convId = parseInt(String(Math.floor(Math.random() * Date.now())).slice(0, 10));
        const msgId = parseInt(String(Math.floor(Math.random() * Date.now())).slice(0, 10));

        /**
         *  Ciphering the message with creating key and iv for aes-192-cbc
         */

        const key = crypto.randomBytes(24);
        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipheriv('aes-192-ctr', key, iv);
        let encrypted_msg = cipher.update(content, 'utf-8', 'hex');
        encrypted_msg += cipher.final('hex');

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

            return { user_id: participantId, conversation_id: convId };
        });
        const participantsPayload = await Promise.all(participantsPayloadPromise);
        participantsPayload.push({
            user_id: connectedUser.id,
            conversation_id: convId,
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
                conversation_id: convId,
                owner_id: participantId,
                key_encrypted: keyEncrypted.toString('base64'),
                iv: iv.toString('hex'),
            };
        });
        const keysPayload = await Promise.all(keysPayloadPromise);
        const connectedUserEncryptedKey = crypto.publicEncrypt(
            Buffer.from(connectedUser.publicKey),
            Buffer.from(key)
        );
        keysPayload.push({
            conversation_id: convId,
            owner_id: connectedUser.id,
            key_encrypted: connectedUserEncryptedKey.toString('base64'),
            iv: iv.toString('hex'),
        }); // Pushing into the array the user who created the conversation

        /**
         *  Preparing conversation and message payloads.
         */

        const convPayload = {
            id: convId,
            last_msg_content: encrypted_msg,
            last_msg_author: connectedUser.id,
            last_msg_read: false,
            last_msg_id: msgId,
        };

        const msgPayload = {
            id: msgId,
            author: connectedUser.id,
            conversation_id: convId,
            content: encrypted_msg,
            read: false,
        };

        /**
         *  Inserting data into the database
         */

        const trx = await Database.transaction();
        try {
            await Conversation.create(convPayload, { client: trx });
            await Message.create(msgPayload, { client: trx });
            await Key.createMany(keysPayload, { client: trx });
            //@ts-ignore
            await Participant.createMany(participantsPayload, { client: trx });
            await trx.commit();
        } catch (e) {
            await trx.rollback();
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

        let private_key: string;
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
            private_key = tokenObject.meta.privateKey;
        } else {
            private_key = session.get('key');
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

        /**
         * Deciphering conversations, serializing them, and adding the username of the receiver
         */

        const userConversationsSerialized = userConversations.map((element) => element.serialize());

        const userConversationsMap = userConversationsSerialized.map(async (element) => {
            const convId = element.id;

            //Decrypt key_AES and get iv
            const { keyEncrypted, iv } = (
                await Key.query()
                    .where('conversation_id', convId)
                    .andWhere('owner_id', userId)
                    .select('key_encrypted', 'iv')
            )[0];
            const keyAES = crypto.privateDecrypt(
                Buffer.from(private_key),
                Buffer.from(keyEncrypted, 'base64')
            );

            //Decrypt message
            const decipher = crypto.createDecipheriv('aes-192-ctr', keyAES, Buffer.from(iv, 'hex'));
            let decryptedMsg = decipher.update(element.last_msg_content, 'hex', 'utf-8');
            decryptedMsg += decipher.final('utf-8');
            element.last_msg_content = decryptedMsg;

            //Adding participant's username to participants key
            const participantsConversation = element.participants.map(async (elementBis) => {
                const participantId = elementBis.user_id;
                const { username } = (await User.query().where('id', participantId).select('username'))[0];

                return {
                    user_id: participantId,
                    username: username,
                };
            });
            element.participants = await Promise.all(participantsConversation);

            return element;
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

        /**
         *  Get conversation id from database
         */

        const userConversationsId = await Conversation.query().whereHas('participants', (subQuery) => {
            subQuery.where('userId', userId);
        });

        /**
         * Retrieving conversations filtered by the query parameter and deciphering it
         */

        const data = userConversationsId.map(async (element) => {
            /**
             * Retrieving conversations filtered by the query parameter and serializing it
             */

            const dataEncrypted = await Participant.query()
                .where('conversation_id', element.id)
                .andWhereNot('user_id', userId)
                .whereHas('users', (subQuery) => subQuery.where('username', 'like', `${query}%`))
                .preload('conversations', (query) => query.orderBy('updated_at', 'desc'))
                .offset(offsetInt)
                .select('conversation_id', 'user_id')
                .limit(12);

            const dataSerialized = dataEncrypted.map((conv) => conv.serialize());

            /**
             * Deciphering the conversations and adding the redceiver's username to the data
             */

            const dataMap = dataSerialized.map(async (element) => {
                const conv_id = element.conversation.id;

                /**
                 * Deciphering key and last message sent
                 */

                const { keyEncrypted, iv } = (
                    await Key.query()
                        .where('conversation_id', conv_id)
                        .andWhere('owner_id', userId)
                        .select('key_encrypted', 'iv')
                )[0];
                const key_AES = crypto.privateDecrypt(
                    Buffer.from(privateKey),
                    Buffer.from(keyEncrypted, 'base64')
                );

                const decipher = crypto.createDecipheriv('aes-192-ctr', key_AES, Buffer.from(iv, 'hex'));
                let decryptedMsg = decipher.update(element.conversation.last_msg_content, 'hex', 'utf-8');
                decryptedMsg += decipher.final('utf-8');
                element.conversation.last_msg_content = decryptedMsg;

                /**
                 * Adding receiver's username to data
                 */

                const receiverId = element.user_id;
                const { username } = (await User.query().where('id', receiverId).select('username'))[0];
                element.receiver_username = username;
                element.receiver_id = element.user_id;
                delete element.user_id;
                delete element.conversation_id;

                return element;
            });

            const conversations = await Promise.all(dataMap);

            return conversations;
        });

        //Promises...
        const payload = await Promise.all(data);

        //Returning response
        return response.status(200).json({ data: payload, status: 'Ok' });
    }
}
