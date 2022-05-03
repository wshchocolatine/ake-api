import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import Database from '@ioc:Adonis/Lucid/Database';
import { base64, cuid } from '@ioc:Adonis/Core/Helpers';
import Redis from '@ioc:Adonis/Addons/Redis';
import crypto from 'crypto';
import MessageStatus from 'App/Models/MessageStatus';
import Participant from 'App/Models/Participant';
import Key from 'App/Models/Key';
import Message from 'App/Models/Message';
import StoreMessageValidator from 'App/Validators/StoreMessageValidator';

export default class MessagesController {
    /**
     *  SEND MESSAGE
     *
     *  Send a basic message to an account on Ake.
     *
     *  @route POST  /message/send
     *
     */

    public async Send({ response, request, auth, session }: HttpContextContract): Promise<void> {
        /**
         * Validating and getting data
         */

        const { convId, content } = await request.validate(StoreMessageValidator);
        const connectedUserId = auth.user!.id;

        /**
         *  Getting private key, if session auth : it is in sessions cookies, if token auth : it is in the meta of the token
         */

        let privateKey: string;
        const authorizationHeader = request.header('authorization');

        if (authorizationHeader !== undefined) {
            const parts = authorizationHeader.split(' ');
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
         * Getting all participants id of the conversation and creating message statutes payloads
         */

        const participantsIds = await Participant.query()
            .whereHas('conversations', (subquery) => subquery.where('id', convId))
            .whereNot('user_id', connectedUserId)
            .select('user_id');

        const messageStatusesPayload = participantsIds.map((element) => {
            return {
                userId: element.userId,
                read: false,
            };
        });
        messageStatusesPayload.push({
            userId: connectedUserId,
            read: true,
        }); //Pushing into the array the user who sent the message

        /**
         * Getting key and iv from database and ciphering the message
         */

        const { keyEncrypted, iv } = (
            await Key.query()
                .where('conversation_id', convId)
                .andWhere('owner_id', connectedUserId)
                .select('key_encrypted', 'iv')
        )[0];
        const keyAES = crypto.privateDecrypt(Buffer.from(privateKey), Buffer.from(keyEncrypted, 'base64'));

        const cipher = crypto.createCipheriv('aes-192-ctr', keyAES, Buffer.from(iv, 'hex'));
        let encryptedMsg = cipher.update(content, 'utf-8', 'hex');
        encryptedMsg += cipher.final('hex');

        /**
         * Posting message and creating messages statutes
         */

        const trx = await Database.transaction();
        try {
            const msgId = cuid();

            const msgPayload = {
                id: msgId,
                authorId: connectedUserId,
                conversationId: convId,
                content: encryptedMsg,
            };

            await (await Message.create(msgPayload, { client: trx }))
                .related('messageStatuses')
                .createMany(messageStatusesPayload);

            await trx.commit();
        } catch (e) {
            console.log(e);
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
     * GET MESSAGE
     *
     * Get 50 message of a conversation filtered by date from offset parameter
     *
     * @route GET  /message/get:offset?
     */

    public async Get({ request, response, auth, session }: HttpContextContract): Promise<void> {
        /**
         *  Getting data from request
         */
        const { convId, offset } = request.qs();
        const offsetInt = parseInt(offset);

        if (convId === undefined || isNaN(offset)) {
            return response.badRequest({
                status: 'Bad Request',
                errors: { message: 'Parameters are invalid or missing' },
            });
        }

        const connectedUser = auth.user!;

        /**
         * 	Getting private key, if session auth : it is in sessions cookies, if token auth : it is in the meta of the token
         */

        let privateKey: string;
        const authorizationHeader = request.header('authorization');

        if (authorizationHeader !== undefined) {
            const parts = authorizationHeader.split(' ');
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
         * Getting encrypted messages, keys and iv from database
         */

        const { keyEncrypted, iv } = (
            await Key.query()
                .where('conversation_id', convId)
                .andWhere('owner_id', connectedUser.id)
                .select('key_encrypted', 'iv')
        )[0];
        const keyAes = crypto.privateDecrypt(Buffer.from(privateKey), Buffer.from(keyEncrypted, 'base64'));

        const messagesEncrypted = await Message.query()
            .where('conversation_id', convId)
            .orderBy('created_at', 'desc')
            .offset(offsetInt)
            .limit(50);

        /**
         * Deciphering messages and serializing them
         */

        const messagesPromise = messagesEncrypted.map(async (element) => {
            element.serialize();

            const decipher = crypto.createDecipheriv('aes-192-ctr', keyAes, Buffer.from(iv, 'hex'));
            let decryptedMsg = decipher.update(element.content, 'hex', 'utf-8');
            decryptedMsg += decipher.final('utf-8');

            const { read } = (
                await MessageStatus.query()
                    .where('message_id', element.id)
                    .andWhere('user_id', connectedUser.id)
            )[0];

            return {
                id: element.id,
                content: decryptedMsg,
                author_id: element.authorId,
                conversation_id: element.conversationId,
                read,
                created_at: element.createdAt,
            };
        });
        const messages = await Promise.all(messagesPromise);

        return response.status(200).json({
            data: messages,
            status: 'Ok',
        });
    }

    /**
     *  READ MESSAGE
     *
     *  Mark all message of an conversations as "read"
     *
     *  @route GET  /message/read:msg_id?
     */

    public async Read({ request, response, auth }: HttpContextContract): Promise<void> {
        //Getting data
        const { msgId } = request.qs();
        const connectedUser = auth.user!;

        if (msgId === undefined) {
            return response.badRequest({
                status: 'Bad Request',
                errors: { message: 'Parameters are missing or invalid' },
            });
        }

        //QUERYING DB
        const trx = await Database.transaction();
        try {
            const msg = await Message.findOrFail(msgId, { client: trx });

            await MessageStatus.query({ client: trx })
                .andWhereHas('messages', (subquery) => subquery.where('conversation_id', msg.conversationId))
                .andWhere('user_id', connectedUser.id)
                .andWhere('created_at', '<=', String(msg.createdAt))
                .andWhere('read', false)
                .update({ read: true });

            await trx.commit();
        } catch (e) {
            console.log(e);
            await trx.rollback();
            return response.internalServerError({
                status: 'Internal Server Error',
                errors: { message: 'Error at transaction' },
            });
        }

        return response.created({ status: 'Created' });
    }
}
