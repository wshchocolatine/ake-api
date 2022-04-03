/* 
    Modules 
*/


import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Database from '@ioc:Adonis/Lucid/Database'
let crypto = require('crypto')


/* 
    Models 
*/

import Conversation from 'App/Models/Conversation'
import Key from 'App/Models/Key'
import Message from 'App/Models/Message'

/* 
    Validators
*/

import StoreMessageValidator from 'App/Validators/StoreMessageValidator'



export default class MessagesController {
    public async Send({ response, request, auth, session }: HttpContextContract): Promise<void> {
        try {
            //Checking data
            try {
                await request.validate(StoreMessageValidator)
            } catch (e) {
                return response.badRequest({ status: "badRequest", errors: e })
            }

            //Checking auth
            if (auth.user!.public_key === undefined) {
                return response.internalServerError({ status: "internalServerError", errors: 'Erreur de session, contacte moi sur Discord' })
            }

            //Getting data
            let { conv_id, content } = await request.validate(StoreMessageValidator)
            let user_id = auth.user!.id
            

            //INSERTING INTO DATABASE

            //1.Getting the key and the iv + encrypting the message
            //Getting keys and iv
            let { key_encrypted, iv } = (await Key.query().where('conversation_id', conv_id).andWhere('owner_id', user_id).select('key_encrypted', 'iv'))[0]
            let key_AES = crypto.privateDecrypt(Buffer.from(session.get('key')), Buffer.from(key_encrypted, 'base64'))

            //Encrypting message
            let cipher = crypto.createCipheriv('aes-192-ctr', key_AES, Buffer.from(iv, 'hex'))
            let encrypted_msg = cipher.update(content, 'utf-8', 'hex')
            encrypted_msg += cipher.final('hex')

            //2.Posting message and updating conversation
            //Creating transaction
            let trx = await Database.transaction()
            try {
                //Creating an id for message
                let msg_id = parseInt(String(Math.floor(Math.random() * Date.now())).slice(0, 10))

                //Inserting msg in db 
                let msg_payload = {
                    id: msg_id,
                    author: auth.user!.id,
                    conversation_id: conv_id,
                    content: encrypted_msg,
                    read: false
                }
                await Message.create(msg_payload, { client: trx })

                //Updating conversation
                let conversation = await Conversation.findOrFail(conv_id, { client: trx })   //Find conversation
                await conversation.merge({ last_msg_content: encrypted_msg, last_msg_author: auth.user!.id, last_msg_read: false, last_msg_id: msg_id }).useTransaction(trx).save()

                //Commit changements
                await trx.commit()
            } catch (e) {
                await trx.rollback()
                return response.internalServerError({ errors: e })
            }


            //Everything 😀
            return response.created({ status: "created" })
        } catch (e) {
            return response.internalServerError({ status: "internalServerError", errors: e })
        }
    }

    public async Get({ request, response, auth, session }: HttpContextContract): Promise<void> {
        try {
            //Getting data
            let { conv_id, offset } = request.qs()
            let user_id = auth.user!.id

            //QUERYING DB

            //1.Getting encrypted messages and keys
            //Getting keys and iv
            let { key_encrypted, iv } = (await Key.query().where('conversation_id', conv_id).andWhere('owner_id', user_id).select('key_encrypted', 'iv'))[0]
            let key_AES = crypto.privateDecrypt(Buffer.from(session.get('key')), Buffer.from(key_encrypted, 'base64'))

            //Getting messages
            let messages = await Message.query().where('conversation_id', conv_id).orderBy('created_at', 'desc').offset(offset).limit(50)

            //2.Decrypting messages
            messages.forEach((element) => {
                let decipher = crypto.createDecipheriv('aes-192-ctr', key_AES, Buffer.from(iv, 'hex'))
                let decrypted_msg = decipher.update(element.content, 'hex', 'utf-8')
                decrypted_msg += decipher.final('utf-8')
                element.content = decrypted_msg
                element.serialize()
            })

            return response.status(200).json({ data: messages, status: "ok" })
        } catch (e) {
            return response.internalServerError({ status: "internalServerError", errors: e })
        }
    }

    public async Read({ request, response }: HttpContextContract): Promise<void> {
        try {
            //Getting data
            let { msg_id } = request.qs()

            //QUERYING DB
            let trx = await Database.transaction()
            try {
                let arrayMsg = await Database.from('messages').where('id', msg_id).update({ read: true }, ['conversation_id', 'created_at'])  //Update last_msg + infos abt him
                let conv_id = arrayMsg[0].conversation_id
                let created_at = arrayMsg[0].created_at

                //Update status of the latest msg of the same discussion
                await Database.from('messages').where('conversation_id', conv_id).where('created_at', '<', created_at).where('read', false).update({ read: true })

                //Update conversation
                await Database.from('conversations').where('id', conv_id).update({ last_msg_read: true })
                await trx.commit()
            } catch (e) {
                await trx.rollback()
                return response.internalServerError({ errors: e })
            }

            return response.created({ status: "created" })
        } catch (e) {
            return response.internalServerError({ status: "internalServerError", errors: e })
        }
    }
}
