import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Database from '@ioc:Adonis/Lucid/Database'
import crypto from "crypto"
import CryptoJS from "crypto-js"
// let CryptoJS = require('crypto-js')
import User from 'App/Models/User'
import LoginUserValidator from 'App/Validators/LoginUserValidator'
import StoreUserValidator from 'App/Validators/StoreUserValidator'
import FinishStoreUserValidator from 'App/Validators/FinishStoreUserValidator'
import { socketAuth } from '../../utils/socket-auth/index'



export default class AuthController {

    /**
     *  REGISTER 
     * 
     *  Create an account on Ake. 
     *  It doesn't create an account in database but allows you to start the second step of the register process. 
     * 
     *  @route POST  /register 
     * 
     */

    public async Register({ response, request, session }: HttpContextContract): Promise<void> {
        try {

            /**
             *  Validating and getting data
             */

            try {
                await request.validate(StoreUserValidator)
            } catch (e) {
                let status = e.messages.errors[0].message.split(':')[0]
                return response.status(parseInt(status)).json({ status: "badRequest", errors : e })
            }

            let { username, email, password } = await request.validate(StoreUserValidator)

            /**
             *  Keeping data in session to finish the register process when user will call /register/finish
             */

            session.put('username', username)
            session.put('email', email)
            session.put('password', password)

            return response.created({ status: "created" })
        } catch (e) {
            return response.internalServerError()
        }
    }


    /**
     *  FINISH REGISTER 
     * 
     *  Create an account on Ake. 
     *  It create an account on Ake and store it into database. You must call /register before. 
     * 
     *  @route POST  /register/finish
     *  
     */

    public async Finish_Register({ request, response, session, auth }: HttpContextContract): Promise<any> {
        try {
            //If he has not started the first step of register, we stop it here
            if (session.has('username')) {

                /**
                 *  Validating and getting data
                 */

                try {
                    await request.validate(FinishStoreUserValidator)
                } catch (e) {
                    return response.badRequest({ status: "badRequest", errors: e })
                }

                let { description } = await request.validate(FinishStoreUserValidator)
                let { username, email, password } = session.all()


                /**
                 *  Generating user's id and keys
                 */

                async function generateId(): Promise<number> {
                    let id = Math.floor(Math.random() * 10000)
                    if ((await Database.from('users').where('username', username).andWhere('tag', id)).length >= 1) {
                        return await generateId()
                    }
                    return id
                }
                let tag = await generateId()


                let { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
                    modulusLength: 2048,
                    publicKeyEncoding: { type: 'spki', format: 'pem' },
                    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
                })


                /**
                 *  Creating user's payload and storing it into database
                 */

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

                /**
                 *  Login user, if :token? param is passed, we logged the user with a token. Otherwise, it is with basic sessions cookies.
                 */

                if (request.qs().token !== undefined) {
                    let token = await auth.use('api').attempt(email, password, { name: 'For the CLI app', expiresIn: '30mins', meta: { privateKey }})
                    return response.created({ status: "created", data: { token }})
                }

                session.put('key', privateKey)
                await auth.use('web').login(user)

                return response.created({ status: "created" })
            } else {
                return response.forbidden({ status: "forbidden" })
            }
        } catch (e) {
            return response.internalServerError({ status: "internalServerError", errors: e })
        }
    }


    /**
     *  LOGIN 
     * 
     *  Login to your account on Ake. 
     * 
     *  @route POST  /login 
     * 
     */

    public async Login({ response, request, auth, session }: HttpContextContract): Promise<void> {
        try {
            try {
                await request.validate(LoginUserValidator)
            } catch (e) {
                let status = e.messages.errors[0].message.split(':')[0]
                return response.status(parseInt(status)).json({ status: "badRequest", errors: e })
            }
            //Getting Data
            let { email, password } = await request.validate(LoginUserValidator)

            //Login user
            try {
                //Token authentication
                if (request.qs().token !== undefined) {
                    let priavte_key_encrypted: string = (await User.query().where('email', email))[0].private_key
                    let privateKey: string = CryptoJS.enc.Utf8.stringify(CryptoJS.AES.decrypt(priavte_key_encrypted, password))

                    let token = await auth.use('api').attempt(email, password, { name: 'For the CLI app', expiresIn: '30mins', meta: { privateKey }})

                    return response.created({ status: 'created', data: { token } })
                } 
                
                //Web authentication
                else {
                    await auth.use('web').attempt(email, password)
                    session.put('key', CryptoJS.enc.Utf8.stringify(CryptoJS.AES.decrypt(auth.user!.private_key, password)))
                    return response.created({ status: "created" })
                }
            } catch (e) {
                //Returning bad credentials
                console.log(e)
                return response.unauthorized({ status: "unauthorized", errors: e })
            }
        } catch (e) {
            return response.internalServerError({ status: "internalServerError", errors: e })
        }
    }


    /**
     *  LOGOUT 
     * 
     *  Logout of your account. 
     *  You must be logged in before calling this route. 
     * 
     *  @route GET  /logout
     * 
     */

    public async Logout({ request, response, auth }: HttpContextContract): Promise<void> {
        try {

            if (request.qs().token !== undefined) {
                await auth.use('api').revoke()
            } else {
                await auth.use('web').logout()
            }
            

            //Everything good
            return response.created({ status: "ok" })
        } catch (e) {
            return response.internalServerError({ status: "internalServerError", errors: e })
        }
    }


    /**
     *  TOKEN 
     * 
     *  Generate an auth token for authenticating yourself with sockets. 
     * 
     *  @route GET  /token
     * 
     */

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
