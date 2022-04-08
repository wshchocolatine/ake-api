import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Application from '@ioc:Adonis/Core/Application'
import User from 'App/Models/User'
import StoreProfilePictureValidator from 'App/Validators/StoreProfilePictureValidator'
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
}
