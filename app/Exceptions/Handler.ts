/*
|--------------------------------------------------------------------------
| Http Exception Handler
|--------------------------------------------------------------------------
|
| AdonisJs will forward all exceptions occurred during an HTTP request to
| the following class. You can learn more about exception handling by
| reading docs.
|
| The exception handler extends a base `HttpExceptionHandler` which is not
| mandatory, however it can do lot of heavy lifting to handle the errors
| properly.
|
*/

import Logger from '@ioc:Adonis/Core/Logger';
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import HttpExceptionHandler from '@ioc:Adonis/Core/HttpExceptionHandler';
import { getReasonPhrase } from 'http-status-codes';

export default class ExceptionHandler extends HttpExceptionHandler {
    constructor() {
        super(Logger);
    }

    public async handle(error: any, ctx: HttpContextContract) {
        if (error.code === 'E_VALIDATION_FAILURE') {
            const statusNumber = error.messages.errors[0].message.split(':')[0];
            const messageError = error.messages.errors[0].message.split(':')[1];
            error.messages.errors[0].message = messageError;
            return ctx.response.status(statusNumber).json({
                status: getReasonPhrase(statusNumber),
                errors: error.messages.errors[0],
            });
        }

        if (error.code === 'E_INVALID_AUTH_PASSWORD' || error.code === 'E_INVALID_AUTH_UID') {
            return ctx.response.status(401).json({
                status: 'Unauthorized',
                errors: {
                    message: 'Bad credentials'
                },
            });
        }

        if (error.code === 'E_UNAUTHORIZED_ACCESS') {
            return ctx.response.status(401).json({
                status: 'Unauthorized',
            });
        }

        if (error.code === 'E_INTERNAL_SERVER_ERROR') {
            return ctx.response.internalServerError({
                status: 'Internal Server Error',
            });
        }

        if (error.code === 'E_ROUTE_NOT_FOUND') {
            return ctx.response.notFound({
                status: 'Not Found',
            });
        }
    }
}
