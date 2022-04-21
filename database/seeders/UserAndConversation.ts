import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import Database from '@ioc:Adonis/Lucid/Database'
import { UserFactory } from 'Database/factories'
import crypto from 'crypto'
import Conversation from 'App/Models/Conversation'
import Message from 'App/Models/Message'
import Key from 'App/Models/Key'
import Participant from 'App/Models/Participant'
import User from 'App/Models/User'


export default class UserAndConversationSeeder extends BaseSeeder {
  public async run () {

      /**
       * Creating three users (louis, marin, ake)
       */
      await UserFactory
        .merge([
          {
            username: 'louis', 
            tag: 1,
            email: 'louis@ake-app.com'
          }, 
          {
            username: 'marin', 
            tag: 1, 
            email: 'marin@ake-app.com'
          }, 
          {
            username: 'ake', 
            tag: 1,
            email: 'ake@ake-app.com'
          }
        ])
        .createMany(3)


        /**
         * Creating conversations between "louis" and "marin" users
         */

        const louisUser = await User.findByOrFail('id', 1)
        const marinUser = await User.findByOrFail('id', 2)

        const message = "First message of the first conversation"

        const key = crypto.randomBytes(24)
        const iv = crypto.randomBytes(16)

        const cipher = crypto.createCipheriv('aes-192-ctr', key, iv)
        let encrypted_msg = cipher.update(message, 'utf-8', 'hex')
        encrypted_msg += cipher.final('hex')

        const louisPublicKey = louisUser.public_key
        const marinPublicKey = marinUser.public_key

        const louisEncryptedKey = crypto.publicEncrypt(Buffer.from(louisPublicKey), Buffer.from(key))
        const marinEncrypedKey = crypto.publicEncrypt(Buffer.from(marinPublicKey), Buffer.from(key))
        

        const msgId = 1
        const conversationId = 1

        const convPayload = {
          id: conversationId,
          last_msg_content: encrypted_msg, 
          last_msg_author: louisUser.id, 
          last_msg_read: false, 
          last_msg_id: msgId
        }

        const msgPayload = {
          id: msgId, 
          author: louisUser.id, 
          conversation_id: conversationId, 
          content: encrypted_msg, 
          read: false
        }

        const keyPayload = [
          {
            conversation_id: conversationId, 
            owner_id: louisUser.id, 
            key_encrypted: louisEncryptedKey.toString('base64'),
            iv: iv.toString('hex')
          }, 
          {
            conversation_id: conversationId, 
            owner_id: marinUser.id, 
            key_encrypted: marinEncrypedKey.toString('base64'), 
            iv: iv.toString('hex')
          }
        ]

        const participantPayload = [
          {
            user_id: louisUser.id, 
            conversation_id: conversationId, 
          }, 
          {
            user_id: marinUser.id, 
            conversation_id: conversationId
          }
        ]

        const trx = await Database.transaction()
        try {
          await Conversation.create(convPayload, { client: trx })
          await Participant.createMany(participantPayload, { client: trx })
          await Message.create(msgPayload, { client: trx })
          await Key.createMany(keyPayload, { client: trx })

          await trx.commit()
        } catch(e) {
          console.log(e)
          await trx.rollback()
        }
  }
}
