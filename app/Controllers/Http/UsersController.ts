import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import StoreProfilePictureValidator from 'App/Validators/StoreProfilePictureValidator'
import User from 'App/Models/User'
import Application from '@ioc:Adonis/Core/Application'
import ChangeDescriptionValidator from 'App/Validators/ChangeDescriptionValidator'
import ChangeUsernameValidator from 'App/Validators/ChangeUsernameValidator'

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

    /*  public async Check_STCP({ request, response, auth }: HttpContextContract): Promise<void> {
            try {
                //Checking data
                try {
                    await request.validate(CheckSTCPValidator)
                } catch (e) {
                    return response.badRequest({ errors: e })
                }
    
                //Getting data
                let { stcp } = await request.validate(CheckSTCPValidator)
    
                //Checking it
                //Query db
                let userData = (await Database.from('users').where('id', auth.user!.id))[0]
    
                if (await Hash.verify(userData.stcp, stcp)) {
                    //If answer is good
                    await Database.from('users').update({ is_changing_password: true })
                    return response.created({ status: "created" })
                } else {
                    //If answer is false
                    return response.unauthorized({ status: "unauthorized" })
                }
            } catch (e) {
                return response.internalServerError({ status: "internalServerError", errors: e })
            }
        } 
    
        public async Check_Pass({ request, response, auth }: HttpContextContract): Promise<void> {
            try {
                //Checking data
                try {
                    await request.validate(CheckPassValidator)
                } catch (e) {
                    return response.badRequest({ status: "badRequest", errors: e })
                }
    
                //Getting data
                let { password } = await request.validate(CheckPassValidator)
    
                //Checking it
                //Query db
                let userData = (await Database.from('users').where('id', auth.user!.id))[0]
    
                if (await Hash.verify(userData.password, password)) {
                    //If answer is good
                    await Database.from('users').update({ is_changing_password: true })
                    return response.created({ status: "created" })
                } else {
                    //If answer is false
                    return response.unauthorized({ status: "unauthorized" })
                }
            } catch (e) {
                return response.internalServerError({ status: "internalServerError", errors: e })
            }
    
        }
    
        public async Change_Pass({ request, response, session, auth }: HttpContextContract): Promise<any> {
            try {
                //Checking process 
                if ((await User.findOrFail(auth.user!.id)).is_changing_password === false) {
                    return response.forbidden({ status: "forbidden" })
                }
                //Checking data
                try {
                    await request.validate(ChangePasswordValidator)
                } catch (e) {
                    return response.badRequest({ status: "badRequest", errors: e })
                }
    
                //Getting data
                let { password } = await request.validate(ChangePasswordValidator)
    
                //QUERYING DB
                //Changing password
                let user = await User.findOrFail(auth.user!.id)  //Getting user
                user.password = password  //Saving new password 
    
                //Getting private_key to cipher it later with the new password
                let private_key = session.get('key')
                user.private_key = private_key
    
                //Closing the process by changing this field from true to false
                user.is_changing_password = false
    
                //Saving changements to the user
                await user.save()
    
                //Everything good!!!
                return response.created({ status: "created" })
            } catch (e) {
                return response.internalServerError({ status: "internalServerError", errors: e })
            }
        } */

    /* import Database from '@ioc:Adonis/Lucid/Database'
       import Hash from '@ioc:Adonis/Core/Hash'
       import CheckPassValidator from 'App/Validators/CheckPassValidator'
       import CheckSTCPValidator from 'App/Validators/CheckSTCPValidator'
       import ChangePasswordValidator from 'App/Validators/ChangePasswordValidator' */
}
