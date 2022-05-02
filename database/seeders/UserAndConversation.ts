import BaseSeeder from '@ioc:Adonis/Lucid/Seeder';
import Database from '@ioc:Adonis/Lucid/Database';
import { UserFactory } from 'Database/factories';
import crypto from 'crypto';
import Conversation from 'App/Models/Conversation';
import Message from 'App/Models/Message';
import MessageStatus from 'App/Models/MessageStatus';
import Key from 'App/Models/Key';
import Participant from 'App/Models/Participant';
import User from 'App/Models/User';

export default class UserAndConversationSeeder extends BaseSeeder {
    public async run() {
        /**
         * Creating three users (louis, marin, ake)
         */
        await UserFactory.merge([
            {
                username: 'louis',
                tag: 1,
                email: 'louis@ake-app.com',
            },
            {
                username: 'marin',
                tag: 1,
                email: 'marin@ake-app.com',
            },
            {
                username: 'ake',
                tag: 1,
                email: 'ake@ake-app.com',
            },
        ]).createMany(3);

        /**
         * Creating conversations between "louis" and "marin" users
         */

        const louisUser = await User.findByOrFail('email', 'louis@ake-app.com');
        const marinUser = await User.findByOrFail('email', 'marin@ake-app.com');

        const message = 'First message of the first conversation';

        const key = crypto.randomBytes(24);
        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipheriv('aes-192-ctr', key, iv);
        let encryptedMsg = cipher.update(message, 'utf-8', 'hex');
        encryptedMsg += cipher.final('hex');

        const louisPublicKey = louisUser.publicKey;
        const marinPublicKey = marinUser.publicKey;

        const louisEncryptedKey = crypto.publicEncrypt(Buffer.from(louisPublicKey), Buffer.from(key));
        const marinEncrypedKey = crypto.publicEncrypt(Buffer.from(marinPublicKey), Buffer.from(key));

        const msgId = 'a';
        const conversationId = 'a';

        const convPayload = {
            id: conversationId,
            creatorId: louisUser.id, 
            firstMessageId: msgId
        };

        const msgPayload = {
            id: msgId,
            authorId: louisUser.id,
            conversationId: conversationId,
            content: encryptedMsg,
        };

        const keyPayload = [
            {
                conversationId: conversationId,
                ownerId: louisUser.id,
                keyEncrypted: louisEncryptedKey.toString('base64'),
                iv: iv.toString('hex'),
            },
            {
                conversationId: conversationId,
                ownerId: marinUser.id,
                keyEncrypted: marinEncrypedKey.toString('base64'),
                iv: iv.toString('hex'),
            },
        ];

        const participantPayload = [
            {
                userId: louisUser.id,
                conversationId: conversationId,
            },
            {
                userId: marinUser.id,
                conversationId: conversationId,
            },
        ];

        const messageStatutesPayload = [
            {
                userId: louisUser.id, 
                read: true
            }, 
            {
                userId: marinUser.id, 
                read: false
            }
        ]

        const trx = await Database.transaction();
        try {
            await Conversation.create(convPayload, { client: trx });
            await Participant.createMany(participantPayload, { client: trx });
            await (await Message.create(msgPayload, { client: trx })).related('messageStatuses').createMany(messageStatutesPayload)
            // await MessageStatus.createMany(messageStatutesPayload, { client: trx})
            await Key.createMany(keyPayload, { client: trx });

            await trx.commit();
        } catch (e) {
            console.log(e);
            await trx.rollback();
        }
    }
}
