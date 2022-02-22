import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import StoreProfilePictureValidator from 'App/Validators/StoreProfilePictureValidator'
import User from 'App/Models/User'
import Application from '@ioc:Adonis/Core/Application'
import ChangeDescriptionValidator from 'App/Validators/ChangeDescriptionValidator'
import ChangeUsernameValidator from 'App/Validators/ChangeUsernameValidator'
/* import ChangePasswordValidator from 'App/Validators/ChangePasswordValidator'
import Hash from '@ioc:Adonis/Core/Hash'
import Key from 'App/Models/Key' 

let crypto = require('crypto') */

export default class UsersController {
    public async Account({ response, auth }: HttpContextContract): Promise<void> {
        try {
            //Gettind data about the user from the auth
            let data = {
                username: auth.user!.username,
                tag: auth.user!.tag,
                email: auth.user!.email,
                description: auth.user!.description,
                id: auth.user!.id
            }

            return response.status(200).json({ data: data, status: "ok" })
        } catch (e) {
            return response.internalServerError({ status: "internalServerError", errors: e })
        }
    }

    public async Other_Account({ request, response }: HttpContextContract): Promise<void> {
        try {
            //Get data abt the request
            let { user_id } = request.qs()

            //Get data from db 
            let user = await User.findOrFail(user_id)

            //Send data
            let payload = {
                user_id: user.id,
                username: user.username,
                tag: user.tag,
                description: user.description
            }
            return response.status(200).json({ data: payload, status: "ok" })
        } catch (e) {
            return response.internalServerError({ errors: e })
        }
    }

    public async Change_Description({ request, response, auth }: HttpContextContract): Promise<void> {
        try {
            //Checking data
            try {
                await request.validate(ChangeDescriptionValidator)
            } catch (e) {
                return response.badRequest({ status: "badRequest", errors: e })
            }

            //Getting data
            let { description } = await request.validate(ChangeDescriptionValidator)
            let user_id = auth.user!.id

            //Querying db 
            let user = await User.findOrFail(user_id)
            user.description = description
            await user.save()

            return response.created({ status: "created" })

        } catch (e) {
            return response.internalServerError({ status: "internalServerError", errors: e })
        }
    }

    public async Change_Username({ request, response, auth }: HttpContextContract): Promise<void> {
        try {
            //Checking data 
            try {
                await request.validate(ChangeUsernameValidator)
            } catch(e) {
                return response.badRequest({ status: "badRequest", errors: e })
            }

            //Getting data
            let user_id = auth.user!.id
            let { username } = await request.validate(ChangeUsernameValidator)

            //Saving changements to db
            let user = await User.findOrFail(user_id)
            user.username = username
            await user.save()

            return response.created({ status: "created" })
        } catch(e) {
            return response.internalServerError({ status: "internalServerError", errors: e })
        }
    }

    public async Store_Profile_Picture({ request, response, auth }: HttpContextContract): Promise<void> {
        try {
            let { picture } = await request.validate(StoreProfilePictureValidator)
            let user_id = auth.user!.id

            await picture.move(Application.tmpPath('uploads'), {
                name: `${user_id}.profilepicture`,
                overwrite: true
            })

            return response.created({ status: "created" })
        } catch (e) {
            return response.internalServerError({ status: "internalServerError", errors: e })
        }
    }

    public async Get_Profile_Picture({ response, auth }: HttpContextContract): Promise<any> {
        let user_id = auth.user!.id
        return response.attachment(
            Application.tmpPath('uploads', `${user_id}.profilepicture`)
        )
    }

/*     public async Change_Password({ request, response, auth, session }: HttpContextContract): Promise<void> {
        try {
            //Authenticating the request 
            await auth.check()

            //Getting data
            let { seed_phrase, new_password, email } = await request.validate(ChangePasswordValidator)

            //If user is already logged in 
            if (auth.isLoggedIn) {
                //Getting user's id and getting user informations
                let user_id = auth.user!.id
                let user = await User.findOrFail(user_id)

                //Getting hashed seed phrase
                let seed_phrase_hashed = user.seed_phrase

                //Checking if seed phrase correct
                if (await Hash.verify(seed_phrase_hashed, seed_phrase)) {
                    //Changing user's password
                    user.password = new_password
                    user.private_key = session.get('key')
                    await user.save()
                } else {
                    return response.unauthorized({ status: "unauthorized" })
                }

            } else {
                //Getting user informations 
                let user = await User.findByOrFail('email', email)

                //Getting hashed seed phrase 
                let seed_phrase_hashed = user.seed_phrase

                //Checking if seed phrase is correct
                if (await Hash.verify(seed_phrase_hashed, seed_phrase_hashed)) {
                    //Recreating keys 
                    let { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
                        modulusLength: 2048,
                        publicKeyEncoding: { type: 'spki', format: 'pem' },
                        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
                    })

                    let user_id = user.id

                    let keys = await Key.query().where('owner_id', user_id)
                    keys.forEach(key => {
                        key.
                    })

                    //Updating user profile
                    user.public_key = publicKey
                    user.private_key = privateKey
                    user.password = new_password
                    await user.save()



                } else {
                    return response.unauthorized({ status : "unauthorized" })
                }
                
            } */

}
