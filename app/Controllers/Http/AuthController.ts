import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import { cuid } from '@ioc:Adonis/Core/Helpers';
import crypto from 'crypto';
import CryptoJS from 'crypto-js';
import User from 'App/Models/User';
import LoginUserValidator from 'App/Validators/LoginUserValidator';
import StoreUserValidator from 'App/Validators/StoreUserValidator';
import { socketAuth } from '../../utils/socket-auth/index';

export default class AuthController {
    /**
     * REGISTER
     *
     * Create an account on Ake.
     * It doesn't create an account in database but allows you to start the second step of the register process.
     *
     * @route POST  /register
     */

    public async Register({ response, request, session, auth }: HttpContextContract): Promise<void> {
        /**
         *  Validating and getting data
         */

        const { username, email, password, description } = await request.validate(StoreUserValidator);

        /**
         *  Generating user's id and keys
         */

        async function generateTag(): Promise<number> {
            const id = Math.floor(Math.random() * 10000);
            if ((await User.query().where('username', username).andWhere('tag', id)).length >= 1) {
                return await generateTag();
            }
            return id;
        }
        const tag = await generateTag();

        const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });

        /**
         *  Creating user's payload and storing it into database
         */

        const payload = {
            id: cuid(),
            username: username,
            tag: tag,
            email: email,
            description: description,
            password: password,
            privateKey: privateKey,
            publicKey: publicKey,
        };

        const user = await User.create(payload);

        //Clearing session
        session.clear();

        /**
         *  Login user, if :token? param is passed, we logged the user with a token. Otherwise, it is with basic sessions cookies.
         */

        if (request.qs().token !== undefined) {
            const token = await auth.use('api').attempt(email, password, {
                name: 'For the CLI app',
                expiresIn: '30mins',
                meta: { privateKey },
            });
            return response.created({ status: 'Created', data: { token } });
        }

        session.put('key', privateKey);
        await auth.use('web').login(user);

        return response.created({ status: 'Created' });
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
        //Getting Data
        const { email, password } = await request.validate(LoginUserValidator);

        //Login user
        try {
            //Token authentication
            if (request.qs().token !== undefined) {
                const privateKeyEncrypted: string = (await User.query().where('email', email))[0].privateKey;
                const privateKey: string = CryptoJS.enc.Utf8.stringify(
                    CryptoJS.AES.decrypt(privateKeyEncrypted, password)
                );

                const token = await auth.use('api').attempt(email, password, {
                    name: 'For the CLI app',
                    expiresIn: '30mins',
                    meta: { privateKey },
                });

                return response.created({ status: 'Created', data: { token } });
            }

            //Web authentication
            else {
                await auth.use('web').attempt(email, password);
                session.put(
                    'key',
                    CryptoJS.enc.Utf8.stringify(CryptoJS.AES.decrypt(auth.user!.privateKey, password))
                );

                return response.created({ status: 'Created' });
            }
        } catch (e) {
            //Returning bad credentials
            return response.unauthorized({
                status: 'Unauthorized',
                errors: { message: 'Bad credentials' },
            });
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
        if (request.qs().token !== undefined) {
            await auth.use('api').revoke();
        } else {
            await auth.use('web').logout();
        }

        //Everything good
        return response.created({ status: 'Ok' });
    }

    /**
     *  TOKEN
     *
     *  Generate an auth token for authenticating yourself with sockets.
     *
     *  @route GET  /token
     *
     */

    public async SocketToken({ auth, response }: HttpContextContract): Promise<void> {
        //Get user_id
        const userId = auth.user!.id;

        //Generate Token
        const opaqueToken = await socketAuth.loginToken(userId, '10min');

        return response.created({
            status: 'Created',
            data: opaqueToken?.toJSON(),
        });
    }
}
