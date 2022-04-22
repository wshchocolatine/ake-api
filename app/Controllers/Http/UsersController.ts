import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Application from '@ioc:Adonis/Core/Application'
import User from 'App/Models/User'
import StoreProfilePictureValidator from 'App/Validators/StoreProfilePictureValidator'
import ChangeDescriptionValidator from 'App/Validators/ChangeDescriptionValidator'
import ChangeUsernameValidator from 'App/Validators/ChangeUsernameValidator'


export default class UsersController {
    public async Account({ response, auth }: HttpContextContract): Promise<void> {
        //Getting data about the user from the auth
        const data = {
            username: auth.user!.username,
            tag: auth.user!.tag,
            email: auth.user!.email,
            description: auth.user!.description,
            id: auth.user!.id
        }
        
        return response.status(200).json({ data: data, status: "Ok" })
    }
    
    public async Other_Account({ request, response }: HttpContextContract): Promise<void> {
        //Get data abt the request
        const { userId } = request.qs()
        
        //Get data from db 
        const user = await User.findOrFail(userId)
        
        //Send data
        const payload = {
            user_id: user.id,
            username: user.username,
            tag: user.tag,
            description: user.description
        }
        return response.status(200).json({ data: payload, status: "Ok" })
    }
    
    public async Change_Description({ request, response, auth }: HttpContextContract): Promise<void> {
        //Getting data
        const { description } = await request.validate(ChangeDescriptionValidator)
        const userId = auth.user!.id
        
        //Querying db 
        const user = await User.findOrFail(userId)
        user.description = description
        await user.save()
        
        return response.created({ status: "Created" })
    }
    
    public async Change_Username({ request, response, auth }: HttpContextContract): Promise<void> {
        //Getting data
        const userId = auth.user!.id
        const { username } = await request.validate(ChangeUsernameValidator)
        
        //Saving changements to db
        const user = await User.findOrFail(userId)
        user.username = username
        await user.save()
        
        return response.created({ status: "Created" })
    }
    
    public async Store_Profile_Picture({ request, response, auth }: HttpContextContract): Promise<void> {
        const { picture } = await request.validate(StoreProfilePictureValidator)
        const userId = auth.user!.id
        
        await picture.move(Application.tmpPath('uploads'), {
            name: `${userId}.profilepicture`,
            overwrite: true
        })
        
        return response.created({ status: "Created" })
    }
    
    public async Get_Profile_Picture({ response, auth }: HttpContextContract): Promise<any> {
        const userId = auth.user!.id
        return response.attachment(
            Application.tmpPath('uploads', `${userId}.profilepicture`)
            )
        }
    }
    