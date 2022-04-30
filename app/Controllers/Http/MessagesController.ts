import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import Database from '@ioc:Adonis/Lucid/Database';
import { base64 } from '@ioc:Adonis/Core/Helpers';
import Redis from '@ioc:Adonis/Addons/Redis';
import crypto from 'crypto';
import Conversation from 'App/Models/Conversation';
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
        const userId = auth.user!.id;

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
         *  Getting key and iv from database and ciphering the message
         */

        const { keyEncrypted, iv } = (
            await Key.query()
                .where('conversation_id', convId)
                .andWhere('owner_id', userId)
                .select('key_encrypted', 'iv')
        )[0];
        const keyAES = crypto.privateDecrypt(Buffer.from(privateKey), Buffer.from(keyEncrypted, 'base64'));

        const cipher = crypto.createCipheriv('aes-192-ctr', keyAES, Buffer.from(iv, 'hex'));
        let encryptedMsg = cipher.update(content, 'utf-8', 'hex');
        encryptedMsg += cipher.final('hex');

        /**
         *  Posting message and updating conversation
         */

        const trx = await Database.transaction();
        try {
            /**
             *  Creating and storing message into database
             */

            const msgId = parseInt(String(Math.floor(Math.random() * Date.now())).slice(0, 10));

            const msgPayload = {
                id: msgId,
                author: auth.user!.id,
                conversation_id: convId,
                content: encryptedMsg,
                read: false,
            };

            await Message.create(msgPayload, { client: trx });

            /**
             *  Updating conversation
             */

            const conversation = await Conversation.findOrFail(convId, {
                client: trx,
            }); //Find conversation
            await conversation
                .merge({
                    lastMsgContent: encryptedMsg,
                    lastMsgAuthor: auth.user!.id,
                    lastMsgRead: false,
                    lastMsgId: msgId,
                })
                .useTransaction(trx)
                .save();

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
     *  GET MESSAGE
     *
     *  Get 50 message of a conversation filtered by date from offset parameter
     *
     *  @route GET  /message/get:offset?
     *
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

        const userId = auth.user!.id;

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
         *  Getting encrypted messages, keys and iv from database
         */

        const { keyEncrypted, iv } = (
            await Key.query()
                .where('conversation_id', convId)
                .andWhere('owner_id', userId)
                .select('key_encrypted', 'iv')
        )[0];
        const keyAes = crypto.privateDecrypt(Buffer.from(privateKey), Buffer.from(keyEncrypted, 'base64'));

        const messages = await Message.query()
            .where('conversation_id', convId)
            .orderBy('created_at', 'desc')
            .offset(offsetInt)
            .limit(50);

        /**
         *  Deciphering messages and serializing them
         */

        messages.forEach((element) => {
            const decipher = crypto.createDecipheriv('aes-192-ctr', keyAes, Buffer.from(iv, 'hex'));
            let decryptedMsg = decipher.update(element.content, 'hex', 'utf-8');
            decryptedMsg += decipher.final('utf-8');
            element.content = decryptedMsg;
            element.serialize();
        });

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

    public async Read({ request, response }: HttpContextContract): Promise<void> {
        //Getting data
        const { msgId } = request.qs();

        if (msgId === undefined) {
            return response.badRequest({
                status: 'Bad Request',
                errors: { message: 'Parameters are missing or invalid' },
            });
        }

        //QUERYING DB
        const trx = await Database.transaction();
        try {
            const arrayMsg = await Message.query()
                .where('id', msgId)
                .update({ read: true }, ['conversation_id', 'created_at']); //Update last_msg + infos abt him
            const convId = arrayMsg[0].conversation_id;
            const createdAt = arrayMsg[0].created_at;

            //Update status of the latest msg of the same discussion
            await Message.query()
                .where('conversation_id', convId)
                .andWhere('created_at', '<', createdAt)
                .andWhere('read', false)
                .update({ read: true });

            //Update conversation
            await Conversation.query().where('id', convId).update({ last_msg_read: true });
            await trx.commit();
        } catch (e) {
            await trx.rollback();
            return response.internalServerError({
                status: 'Internal Server Error',
                errors: { message: 'Error at transaction' },
            });
        }

        return response.created({ status: 'Created' });
    }
}
