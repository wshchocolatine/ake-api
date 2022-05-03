import { schema, rules } from '@ioc:Adonis/Core/Validator';
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';

export default class StoreUserValidator {
    constructor(protected ctx: HttpContextContract) {}

    /*
     * Define schema to validate the "shape", "type", "formatting" and "integrity" of data.
     *
     * For example:
     * 1. The username must be of data type string. But then also, it should
     *    not contain special characters or numbers.
     *    ```
     *     schema.string({}, [ rules.alpha() ])
     *    ```
     *
     * 2. The email must be of data type string, formatted as a valid
     *    email. But also, not used by any other user.
     *    ```
     *     schema.string({}, [
     *       rules.email(),
     *       rules.unique({ table: 'users', column: 'email' }),
     *     ])
     *    ```
     */
    public schema = schema.create({
        username: schema.string([rules.trim(), rules.required()]),
        email: schema.string([
            rules.trim(),
            rules.email(),
            rules.normalizeEmail({
                allLowercase: true,
            }),
            rules.unique({
                table: 'users',
                column: 'email',
            }),
            rules.required(),
        ]),
        password: schema.string([
            rules.trim(),
            rules.required(),
            rules.regex(new RegExp('(?=^.{8,}$)(?=.*[0-9])(?=.*[A-Z])(?=.*[a-z])(?=.*[!@#$%^&*]+).*$')),
        ]),
        description: schema.string([rules.trim(), rules.required(), rules.maxLength(255)]),
    });

    /**
     * Custom messages for validation failures. You can make use of dot notation `(.)`
     * for targeting nested fields and array expressions `(*)` for targeting all
     * children of an array. For example:
     *
     * {
     *   'profile.username.required': 'Username is required',
     *   'scores.*.number': 'Define scores as valid numbers'
     * }
     *
     */
    public messages = {
        required: '400:The {{ field }} field is required',
        'email.unique': '409:Email have to be unique',
        'password.regex': '412:Password is not enough secure',
    };
}
