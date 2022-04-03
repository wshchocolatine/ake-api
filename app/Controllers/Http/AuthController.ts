/* 
    Modules 
*/
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Database from '@ioc:Adonis/Lucid/Database'
let crypto = require('crypto')
let CryptoJS = require('crypto-js')

/* 
    Models 
*/
import User from 'App/Models/User'

/* 
    Validators
*/
import LoginUserValidator from 'App/Validators/LoginUserValidator'
import StoreUserValidator from 'App/Validators/StoreUserValidator'

/* 
    Utils
*/
import FinishStoreUserValidator from 'App/Validators/FinishStoreUserValidator'
import { socketAuth } from '../../utils/socket-auth/index'



export default class AuthController {
    public async Register({ response, request, session }: HttpContextContract): Promise<void> {
        try {
            //Checking data
            try {
                await request.validate(StoreUserValidator)
            } catch (e) {
                let status = e.messages.errors[0].message.split(':')[0]
                return response.status(parseInt(status)).json({ status: "badRequest", errors : e })
            }
            //Getting data
            let { username, email, password } = await request.validate(StoreUserValidator)

            //Keeping data to finish register later
            session.put('username', username)
            session.put('email', email)
            session.put('password', password)

            //Everything good
            return response.created({ status: "created" })
        } catch (e) {
            return response.internalServerError()
        }
    }

    public async Finish_Register({ request, response, session, auth }: HttpContextContract): Promise<any> {
        try {
            //If he has not started the first step of register, we stop it here
            if (session.has('username')) {
                //Checking data 
                try {
                    await request.validate(FinishStoreUserValidator)
                } catch (e) {
                    return response.badRequest({ status: "badRequest", errors: e })
                }

                //Getting data 
                let { description } = await request.validate(FinishStoreUserValidator)
                let { username, email, password } = session.all()

                async function generateId() {
                    let id = Math.floor(Math.random() * 10000)
                    if ((await Database.from('users').where('username', username).andWhere('tag', id)).length >= 1) {
                        return await generateId()
                    }
                    return id
                }
                let tag = await generateId()


                //Creating Keys
                let { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
                    modulusLength: 2048,
                    publicKeyEncoding: { type: 'spki', format: 'pem' },
                    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
                })

                //Creating User
                let payload = {
                    id: parseInt(String(Math.floor(Math.random() * Date.now())).slice(0, 10)),
                    username: username,
                    tag: tag,
                    email: email,
                    description: description,
                    password: password,
                    private_key: privateKey,
                    public_key: publicKey,
                    is_changing_password: false,
                }
                let user = await User.create(payload)

                //Clearing session
                session.clear()

                //Put key
                session.put('key', privateKey)

                //Login User
                await auth.login(user)

                //Everything good
                return response.created({ status: "created" })
            } else {
                return response.forbidden({ status: "forbidden" })
            }
        } catch (e) {
            return response.internalServerError({ status: "internalServerError", errors: e })
        }
    }

    /*public async Seed_Phrase({ response, session }: HttpContextContract): Promise<void> {
        try {
            if (session.has('username')) {
                //Generate seed phrase
                let seed_phrase = rword.generate(12)

                //Putting it in session
                session.put('seed_phrase', seed_phrase)

                //Sending it
                return response.created({ status: "created", data: { 'seed_phrase': seed_phrase }})
            } else {
                return response.forbidden({ status : "forbidden" })
            }
        } catch(e) {
            return response.internalServerError({ status : "internalServerError", errors: e })
        }
    }*/

    public async Login({ response, request, auth, session }: HttpContextContract): Promise<void> {
        try {
            //Checking data
            try {
                await request.validate(LoginUserValidator)
            } catch (e) {
                let status = e.messages.errors[0].message.split(':')[0]
                return response.status(parseInt(status)).json({ status: "badRequest", errors: e })
            }
            //Getting Data
            let { email, password } = request.only(['email', 'password'])

            //Login user
            try {
                await auth.attempt(email, password)
                session.put('key', CryptoJS.enc.Utf8.stringify(CryptoJS.AES.decrypt(auth.user!.private_key, password)))
                return response.created({ status: "created" })
            } catch (e) {
                //Returning bad credentials
                return response.unauthorized({ status: "unauthorized" })
            }
        } catch (e) {
            return response.internalServerError({ status: "internalServerError", errors: e })
        }
    }

    public async Logout({ response, auth }: HttpContextContract): Promise<void> {
        try {
            //Logout user
            await auth.logout()

            //Everything good
            return response.created({ status: "ok" })
        } catch (e) {
            return response.internalServerError({ status: "internalServerError", errors: e })
        }
    }

    public async Token({ auth, response }: HttpContextContract): Promise<any> {
        try {
            //Get user_id
            let user_id = auth.user!.id

            //Generate Token
            let opaqueToken = await socketAuth.loginToken(user_id, '10min')

            return response.created({ status: "created", data: opaqueToken?.toJSON()})
        } catch(e) {
            return response.internalServerError({ errors: e })
        }
    }
}
