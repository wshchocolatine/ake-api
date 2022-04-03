/* 
    Modules 
*/

import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
let crypto = require('crypto')

/* 
    Models 
*/

import Key from 'App/Models/Key'
import Conversation from 'App/Models/Conversation';
import User from 'App/Models/User'
import Participant from 'App/Models/Participant';
import Database from '@ioc:Adonis/Lucid/Database'
import Message from 'App/Models/Message'

/* 
    Validators
*/

import StoreFirstMessageValidator from 'App/Validators/StoreConversationValidator'



export default class ConversationsController {

    /* 
        NEW 

        Used for creating a new conversation with someone 

    */ 

    public async New({ response, request, auth }: HttpContextContract): Promise<void> {
        try {
            //Checking data
            try {
                await request.validate(StoreFirstMessageValidator)
            } catch (e) {
                return response.badRequest({ status: "badRequest", errors: e })
            }

            //Getting data
            let { receiver_username, receiver_tag, content } = await request.validate(StoreFirstMessageValidator)

            //Getting the receiver_id
            let receiver_id_array : User[]

            receiver_id_array = await Database.from('users').where('username', receiver_username).andWhere('tag', receiver_tag).select('id')
            if (receiver_id_array.length === 0) {
                return response.badRequest({ status: "badRequest", errors: "This user doesn't exist" })
            }

            let receiver_id = receiver_id_array[0].id


            //INSERTING DATA IN DB

            //1.Ciphering msg
            //Creating a key and an iv for aes-192-cbc
            let key = crypto.randomBytes(24)
            let iv = crypto.randomBytes(16)

            //Creating the cipher
            let cipher = crypto.createCipheriv('aes-192-ctr', key, iv)
            let encrypted_msg = cipher.update(content, 'utf-8', 'hex')
            encrypted_msg += cipher.final('hex')

            //2.Preparing payloads
            //Creating an id for the conv
            let conv_id = parseInt(String(Math.floor(Math.random() * Date.now())).slice(0, 10))
            //Creating id for the msg
            let msg_id = parseInt(String(Math.floor(Math.random() * Date.now())).slice(0, 10))

            let conv_payload = {
                id: conv_id,
                last_msg_content: encrypted_msg,
                last_msg_author: auth.user!.id,
                last_msg_read: false,
                last_msg_id: msg_id
            }

            let msg_payload = {
                id: msg_id,
                author: auth.user!.id,
                conversation_id: conv_id,
                content: encrypted_msg,
                read: false
            }

            //Ciphering the key and inserting it with the iv in the db
            //Getting the public key of the receiver
            let { public_key } = (await User.query().where('id', receiver_id).select('public_key'))[0]

            //We will have to insert two rows in our db because owner and receiver will not have the same public key. So, we have to cipher for each of them
            let owner_encrypted_key = crypto.publicEncrypt(Buffer.from(auth.user!.public_key), Buffer.from(key)).toString('base64')
            let receiver_encrypted_key = crypto.publicEncrypt(Buffer.from(public_key), Buffer.from(key)).toString('base64')

            //3.Inserting in DB

            let trx = await Database.transaction()
            try {
                await Conversation.create(conv_payload, { client: trx })
                await Participant.createMany([
                    {
                        user_id: auth.user!.id, 
                        conversation_id: conv_id
                    }, 
                    {
                        user_id: receiver_id,
                        conversation_id: conv_id
                    }
                ], { client: trx })
                await Message.create(msg_payload, { client: trx })
                await Key.createMany([
                    {
                        conversation_id: conv_id,
                        owner_id: auth.user!.id,
                        key_encrypted: owner_encrypted_key,
                        iv: iv.toString("hex")
                    },
                    {
                        conversation_id: conv_id,
                        owner_id: receiver_id,
                        key_encrypted: receiver_encrypted_key,
                        iv: iv.toString("hex")
                    }
                ], { client: trx })
                await trx.commit()
            } catch(e) {
                await trx.rollback()
                return response.internalServerError({ errors: e })
            }

            //Everything 😀
            return response.created({ status: "created" })
        } catch (e) {
            return response.internalServerError({ status: "internalServerError", errors: e })
        }
    }


    /* 
        GET 

        Used to get the last (by last message sent) 12 user's conversations from the parameter `offset`

    */

    public async Get({ request, response, auth, session }: HttpContextContract): Promise<Array<object> | void> {
        try {
            //Get user_id
            let user_id = auth.user!.id
            let { offset } = request.qs()

    //GETTING DATA FROM DB AND SENDING IT TO THE CLIENT

        //1.Getting conversations and keys from the db
            let user_conversations = await Conversation.query()
                                                        .preload('participants', (subquery) => subquery.select('user_id').whereNot('user_id', user_id))
                                                        .whereHas('participants', (subquery) => subquery.where('user_id', user_id))
                                                        .orderBy('updated_at', 'desc')
                                                        .offset(offset)
                                                        .limit(12)
            
            //Deciphering it and adding username
            let user_conversations_serialized = user_conversations.map(element => element.serialize())
            let user_conversations_map = user_conversations_serialized.map(async (element) => {
                let conv_id = element.id //Getting the conv_id to get the key associated

                //Decrypt key_AES and get iv
                let { key_encrypted, iv } = (await Key.query().where('conversation_id', conv_id).andWhere('owner_id', user_id).select('key_encrypted', 'iv'))[0]
                let key_AES = crypto.privateDecrypt(Buffer.from(session.get('key')), Buffer.from(key_encrypted, 'base64'))

                //Decrypt message
                let decipher = crypto.createDecipheriv('aes-192-ctr', key_AES, Buffer.from(iv, 'hex'))
                let decrypted_msg = decipher.update(element.last_msg_content, 'hex', 'utf-8')
                decrypted_msg += decipher.final('utf-8')
                element.last_msg_content = decrypted_msg

                //Adding receiver username 
                let { username } = (await User.query().where('id', element.participants[0].user_id).select('username'))[0]
                delete element.participants
                element.receiver_username = username
                return element
            })

            let data = await Promise.all(user_conversations_map)

            //Everything 😀
            return response.status(200).json({ data: data, status: "ok" })
        } catch (e) {
            return response.internalServerError({ status: "internalServerError", errors: e })
        }
    }


    /* 
        SEARCH

        Used for searching user's conversations

    */

    public async Search({ request, response, auth, session }: HttpContextContract): Promise<any> {
        try {
            //Get search content + user_id
            let { query } = request.qs()
            let user_id = auth.user!.id

            //Get all conversations id where there is the connected user
            let user_conversations_id = await Conversation.query()
                                                          .whereHas('participants', (subQuery) => {
                                                              subQuery.where('user_id', user_id)
                                                          })
            
            let data = user_conversations_id.map(async(element) => {
                //Getting conversations 
                let dataEncrypted = await Participant.query()
                                                     .where('conversation_id', element.id)
                                                     .andWhereNot('user_id', user_id)
                                                     .whereHas('users', (subQuery) => subQuery.where('username', 'like', `${query}%`))
                                                     .preload('conversations', query => query.orderBy('updated_at', 'desc'))
                                                     .select('conversation_id', 'user_id')

                //Serialize data
                let dataSerialized = dataEncrypted.map((conv) => conv.serialize())            
    
                //Deciphering it and adding receiver_username
                let data_map = dataSerialized.map(async (element) => {
                    let conv_id = element.conversation.id //Getting the conv_id to get the key associated
    
                    //Decrypt key_AES and get iv
                    let { key_encrypted, iv } = (await Key.query().where('conversation_id', conv_id).andWhere('owner_id', user_id).select('key_encrypted', 'iv'))[0]
                    let key_AES = crypto.privateDecrypt(Buffer.from(session.get('key')), Buffer.from(key_encrypted, 'base64'))
    
                    //Decrypt message
                    let decipher = crypto.createDecipheriv('aes-192-ctr', key_AES, Buffer.from(iv, 'hex'))
                    let decrypted_msg = decipher.update(element.conversation.last_msg_content, 'hex', 'utf-8')
                    decrypted_msg += decipher.final('utf-8')
                    element.conversation.last_msg_content = decrypted_msg

                    //Add receiver_username
                    let receiver_id = element.user_id
                    let { username } = (await User.query().where('id', receiver_id).select('username'))[0]
                    element.receiver_username = username
                    element.receiver_id = element.user_id
                    delete element.user_id
                    delete element.conversation_id

                    return element
                })
    
                let conversations = await Promise.all(data_map)
                return conversations
            })

            //Promises...
            let payload = await Promise.all(data)

            //Returning response
            return response.status(200).json({ data: payload, status: "ok" })
        } catch (e) {
            return response.internalServerError({ errors: e })
        }
    }

}
