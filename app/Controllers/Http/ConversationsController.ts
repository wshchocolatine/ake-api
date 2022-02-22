import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import Key from 'App/Models/Key'
let crypto = require('crypto')
import Conversation from 'App/Models/Conversation';
import User from 'App/Models/User'
import Participant from 'App/Models/Participant';

export default class ConversationsController {
    public async Get({ request, response, auth, session }: HttpContextContract): Promise<Array<object> | void> {
        try {
            //@ts-ignore Get user_id
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

    public async Search({ request, response, auth, session }: HttpContextContract): Promise<any> {
        try {
            //Get search content + user_id
            let { content } = request.qs()
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
                                                     .whereHas('users', (subQuery) => subQuery.where('username', 'like', `${content}%`))
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
