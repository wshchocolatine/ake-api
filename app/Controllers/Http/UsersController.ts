import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import Application from '@ioc:Adonis/Core/Application';
import User from 'App/Models/User';
import StoreProfilePictureValidator from 'App/Validators/StoreProfilePictureValidator';
import ChangeDescriptionValidator from 'App/Validators/ChangeDescriptionValidator';
import ChangeUsernameValidator from 'App/Validators/ChangeUsernameValidator';

export default class UsersController {

    public async AccountInformations({ request, response, auth }: HttpContextContract): Promise<void> {
        const { userId } = request.qs()

        if (userId === undefined) {
            const user = auth.user!.serialize()

            return response.ok({ status: "Ok", data: user })
        } else{
            const user = await User.findOrFail(userId)

            const payload = user.serialize({
                fields: {
                    omit: ['email']
                }
            })

            return response.ok({ status: "Ok", data: payload })
        }
    }

    public async ChangeDescription({ request, response, auth }: HttpContextContract): Promise<void> {
        //Getting data
        const { description } = await request.validate(ChangeDescriptionValidator);
        const userId = auth.user!.id;

        //Querying db
        const user = await User.findOrFail(userId);
        user.description = description;
        await user.save();

        return response.created({ status: 'Created' });
    }

    public async ChangeUsername({ request, response, auth }: HttpContextContract): Promise<void> {
        //Getting data
        const userId = auth.user!.id;
        const { username } = await request.validate(ChangeUsernameValidator);

        //Saving changements to db
        const user = await User.findOrFail(userId);
        user.username = username;
        await user.save();

        return response.created({ status: 'Created' });
    }

    public async Store_Profile_Picture({ request, response, auth }: HttpContextContract): Promise<void> {
        const { picture } = await request.validate(StoreProfilePictureValidator);
        const userId = auth.user!.id;

        await picture.move(Application.tmpPath('uploads'), {
            name: `${userId}.profilepicture`,
            overwrite: true,
        });

        return response.created({ status: 'Created' });
    }

    public async Get_Profile_Picture({ response, auth }: HttpContextContract): Promise<void> {
        const userId = auth.user!.id;
        return response.attachment(Application.tmpPath('uploads', `${userId}.profilepicture`));
    }
}
