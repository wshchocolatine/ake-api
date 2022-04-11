import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import Database from '@ioc:Adonis/Lucid/Database'
import {base64} from '@ioc:Adonis/Core/Helpers'
import crypto from "crypto"
import Key from 'App/Models/Key'
import Conversation from 'App/Models/Conversation';
import User from 'App/Models/User'
import Participant from 'App/Models/Participant';
import Message from 'App/Models/Message'
import StoreFirstMessageValidator from 'App/Validators/StoreConversationValidator'
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
        try {

            /**
             * Getting data and validating it
             */
            
            try {
                await request.validate(StoreFirstMessageValidator)
            } catch (e) {
                return response.badRequest({ status: "badRequest", errors: e })
            }

            let { receiver_username, receiver_tag, content } = await request.validate(StoreFirstMessageValidator)

            let receiver_id_array = await Database.from('users').where('username', receiver_username).andWhere('tag', receiver_tag).select('id')

            if (receiver_id_array.length === 0) {
                return response.badRequest({ status: "badRequest", errors: "This user doesn't exist" })
            }

            let receiver_id = receiver_id_array[0].id


            /**
             *  Checking if a conversations already exists between these users
             */

            let conversation_exists = await Conversation.query()
                                                            .whereHas('participants', (subquery) => subquery.where('user_id', auth.user!.id))
                                                            .andWhereHas('participants', (subquery) => subquery.where('user_id', receiver_id))
            
            if (conversation_exists.length >= 1) {
                return response.conflict({ status: "conflict", errors: "There is already a conversation between these users ! "})
            }


            /**
             *  Ciphering the message with creating key and iv for aes-192-cbc
             */

            let key = crypto.randomBytes(24)
            let iv = crypto.randomBytes(16)

            let cipher = crypto.createCipheriv('aes-192-ctr', key, iv)
            let encrypted_msg = cipher.update(content, 'utf-8', 'hex')
            encrypted_msg += cipher.final('hex')


            /**
             *  Ciphering the key of conversations with the keys of the participants. 
             *  We will have to insert two rows in our db because participants will not have the same public key. So, we have to cipher for each of them.
             */

             let { public_key } = (await User.query().where('id', receiver_id).select('public_key'))[0] 

             let owner_encrypted_key = crypto.publicEncrypt(Buffer.from(auth.user!.public_key), Buffer.from(key)).toString('base64')
             let receiver_encrypted_key = crypto.publicEncrypt(Buffer.from(public_key), Buffer.from(key)).toString('base64')


            /**
             *  Preparing conversation and message payloads. Ids are created for each conversation and message.
             */

            let conv_id = parseInt(String(Math.floor(Math.random() * Date.now())).slice(0, 10))
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

            
            /**
             *  Inserting data into the database
             */

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



    /**
     *  GET CONVERSATION
     * 
     *  Get 12 of your conversations from :offset and classed by time of last message sent.
     *  This route is not returning the messages of your conversations. If you want this, check /messages/get:conv_id? on MessagesController
     * 
     *  @route GET  /conversations/get:offset?
     * 
     */

    public async Get({ request, response, auth, session }: HttpContextContract): Promise<Array<object> | void> {
        try {
            
            /**
             *  Getting data from the request and get private key
             */

            let user_id = auth.user!.id
            let { offset } = request.qs()


            /**
             *  Getting private key, if session auth : it is in sessions cookies, if token auth : it is in the meta of the token
             */
            
            let private_key: string
            let authorization_header = request.header('authorization')

            if ( authorization_header !== undefined) {
                let parts = authorization_header.split(' ')
                let tokenParts = parts[1].split('.')

                let tokenId = base64.urlDecode(tokenParts[0])
                let token = await Redis.get(`api:${tokenId}`)

                if (!token) {
                    return 
                }

                let tokenObject = JSON.parse(token)
                private_key = tokenObject.meta.privateKey
            } else {
                private_key = session.get('key')
            }


            /**
             *  Getting conversations and keys data from the db
             */

            let user_conversations = await Conversation.query()
                                                        .preload('participants', (subquery) => subquery.select('user_id').whereNot('user_id', user_id))
                                                        .whereHas('participants', (subquery) => subquery.where('user_id', user_id))
                                                        .orderBy('updated_at', 'desc')
                                                        .offset(offset)
                                                        .limit(12)

            
            /**
             *  Deciphering conversations, serializing them, and adding the username of the receiver 
             */
        
            let user_conversations_serialized = user_conversations.map(element => element.serialize())
            
            let user_conversations_map = user_conversations_serialized.map(async (element) => {
                let conv_id = element.id 

                //Decrypt key_AES and get iv
                let { key_encrypted, iv } = (await Key.query().where('conversation_id', conv_id).andWhere('owner_id', user_id).select('key_encrypted', 'iv'))[0]
                let key_AES = crypto.privateDecrypt(Buffer.from(private_key), Buffer.from(key_encrypted, 'base64'))

                //Decrypt message
                let decipher = crypto.createDecipheriv('aes-192-ctr', key_AES, Buffer.from(iv, 'hex'))
                let decrypted_msg = decipher.update(element.last_msg_content, 'hex', 'utf-8')
                decrypted_msg += decipher.final('utf-8')
                element.last_msg_content = decrypted_msg

                //Adding receiver username 
                let { username } = (await User.query().where('id', element.participants[0].user_id).select('username'))[0]
                // delete element.participants
                element.receiver_username = username
                return element
            })

            let data = await Promise.all(user_conversations_map)
            

            //Everything 😀
            return response.status(200).json({ data: data, status: "ok" })
        } catch (e) {
            console.log(e)
            return response.internalServerError({ status: "internalServerError", errors: e })
        }
    }



    /**
     *  SEARCH CONVERSATION
     * 
     *  Search your conversation by username of the receiver 
     * 
     *  @route GET  /conversations/search:query?  
     * 
     */

    public async Search({ request, response, auth, session }: HttpContextContract): Promise<any> {
        try {
            /**
             *  Get data from request 
             */

            let { query, offset } = request.qs()
            let user_id = auth.user!.id

            if (typeof offset !== "number") {
                return response.badRequest({ status: "badRequest" })
            }

            /**
             *  Getting private key, if session auth : it is in sessions cookies, if token auth : it is in the meta of the token
             */
            
            let private_key: string
            let authorization_header = request.header('authorization')
            
            if ( authorization_header !== undefined) {
                let parts = authorization_header.split(' ')
                let tokenParts = parts[1].split('.')
                
                let tokenId = base64.urlDecode(tokenParts[0])
                let token = await Redis.get(`api:${tokenId}`)
                
                if (!token) {
                    return 
                }
                
                let tokenObject = JSON.parse(token)
                private_key = tokenObject.meta.privateKey
            } else {
                private_key = session.get('key')
            }
            

            /**
             *  Get conversation id from database
             */
            
            let user_conversations_id = await Conversation.query()
                                                          .whereHas('participants', (subQuery) => {
                                                              subQuery.where('user_id', user_id)
                                                          })
                                                          
            
            /**
             *  Retrieving conversations filtered by the query parameter and deciphering it
             */

            let data = user_conversations_id.map(async(element) => {

                /**
                 *  Retrieving conversations filtered by the query parameter and serializing it 
                 */
 
                let dataEncrypted = await Participant.query()
                                                     .where('conversation_id', element.id)
                                                     .andWhereNot('user_id', user_id)
                                                     .whereHas('users', (subQuery) => subQuery.where('username', 'like', `${query}%`))
                                                     .preload('conversations', query => query.orderBy('updated_at', 'desc'))
                                                     .offset(offset)
                                                     .select('conversation_id', 'user_id')
                                                     .limit(12)

                let dataSerialized = dataEncrypted.map((conv) => conv.serialize())            
    
                /**
                 *  Deciphering the conversations and adding the redceiver's username to the data 
                 */

                let data_map = dataSerialized.map(async (element) => {
                    let conv_id = element.conversation.id 
    
                    /**
                     *  Deciphering key and last message sent 
                     */

                    let { key_encrypted, iv } = (await Key.query().where('conversation_id', conv_id).andWhere('owner_id', user_id).select('key_encrypted', 'iv'))[0]
                    let key_AES = crypto.privateDecrypt(Buffer.from(private_key), Buffer.from(key_encrypted, 'base64'))
    
                    let decipher = crypto.createDecipheriv('aes-192-ctr', key_AES, Buffer.from(iv, 'hex'))
                    let decrypted_msg = decipher.update(element.conversation.last_msg_content, 'hex', 'utf-8')
                    decrypted_msg += decipher.final('utf-8')
                    element.conversation.last_msg_content = decrypted_msg

                    /**
                     *  Adding receiver's username to data 
                     */

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
