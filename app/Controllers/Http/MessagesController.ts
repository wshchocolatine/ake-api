import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Database from '@ioc:Adonis/Lucid/Database'
import { base64 } from '@ioc:Adonis/Core/Helpers'
import Redis from '@ioc:Adonis/Addons/Redis'
import crypto from "crypto"
import Conversation from 'App/Models/Conversation'
import Key from 'App/Models/Key'
import Message from 'App/Models/Message'
import StoreMessageValidator from 'App/Validators/StoreMessageValidator'



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
        
        const { conv_id, content } = await request.validate(StoreMessageValidator)
        const user_id = auth.user!.id
        
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
        *  Getting key and iv from database and ciphering the message 
        */
        
        let { key_encrypted, iv } = (await Key.query().where('conversation_id', conv_id).andWhere('owner_id', user_id).select('key_encrypted', 'iv'))[0]
        let key_AES = crypto.privateDecrypt(Buffer.from(private_key), Buffer.from(key_encrypted, 'base64'))
        
        let cipher = crypto.createCipheriv('aes-192-ctr', key_AES, Buffer.from(iv, 'hex'))
        let encrypted_msg = cipher.update(content, 'utf-8', 'hex')
        encrypted_msg += cipher.final('hex')
        
        
        /**
        *  Posting message and updating conversation
        */
        
        let trx = await Database.transaction()
        try {
            /**
            *  Creating and storing message into database
            */
            
            let msg_id = parseInt(String(Math.floor(Math.random() * Date.now())).slice(0, 10))
            
            let msg_payload = {
                id: msg_id,
                author: auth.user!.id,
                conversation_id: conv_id,
                content: encrypted_msg,
                read: false
            }
            
            await Message.create(msg_payload, { client: trx })
            
            
            /**
            *  Updating conversation
            */
            
            let conversation = await Conversation.findOrFail(conv_id, { client: trx })   //Find conversation
            await conversation.merge({ last_msg_content: encrypted_msg, last_msg_author: auth.user!.id, last_msg_read: false, last_msg_id: msg_id }).useTransaction(trx).save()
            
            await trx.commit()
        } catch (e) {
            await trx.rollback()
            return response.internalServerError({ status: "Internal Server Error", errors: e })
        }
        
        
        //Everything 😀
        return response.created({ status: "Created" })
    }
    
    
    /**
    *  GET MESSAGE 
    * 
    *  Get 50 message of a conversation filtered by date from offset parameter
    * 
    *  @route GET  /conversations/get:offset?
    * 
    */
    
    public async Get({ request, response, auth, session }: HttpContextContract): Promise<void> {
        
        /**
        *  Getting data from request
        */
        let { conv_id, offset } = request.qs()
        let user_id = auth.user!.id
        
        /**
        * 	Getting private key, if session auth : it is in sessions cookies, if token auth : it is in the meta of the token
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
        *  Getting encrypted messages, keys and iv from database
        */
        
        let { key_encrypted, iv } = (await Key.query().where('conversation_id', conv_id).andWhere('owner_id', user_id).select('key_encrypted', 'iv'))[0]
        let key_AES = crypto.privateDecrypt(Buffer.from(private_key), Buffer.from(key_encrypted, 'base64'))
        
        let messages = await Message.query().where('conversation_id', conv_id).orderBy('created_at', 'desc').offset(offset).limit(50)
        
        /**
        *  Deciphering messages and serializing them
        */
        
        messages.forEach((element) => {
            let decipher = crypto.createDecipheriv('aes-192-ctr', key_AES, Buffer.from(iv, 'hex'))
            let decrypted_msg = decipher.update(element.content, 'hex', 'utf-8')
            decrypted_msg += decipher.final('utf-8')
            element.content = decrypted_msg
            element.serialize()
        })
        
        return response.status(200).json({ data: messages, status: "Ok" })
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
            return response.internalServerError({ status: "Internal Server Error", errors: e })
        }
        
        return response.created({ status: "Created" })
    }
}
