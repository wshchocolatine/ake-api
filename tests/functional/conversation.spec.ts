import { test } from '@japa/runner';
import CryptoJS from 'crypto-js';
import User from 'App/Models/User';

/**
 * Testing everything about conversations routes
 * Marin and Louis and Ake user and their conversataion have been created in seeds (/database/seeders/UserAndConversation.ts)
 */

test.group('Conversations', () => {
    test('New Conversation', async ({ client }) => {
        const akeUser = await User.findByOrFail('email', 'ake@ake-app.com');
        const louisUser = await User.findByOrFail('email', 'louis@ake-app.com');

        const payload = {
            participantsWithoutCreator: [`${louisUser.username}#${louisUser.tag}`],
            content: 'Hey, first message :))',
        };

        const response = await client.post('/conversations/new').form(payload).loginAs(akeUser);

        response.assertStatus(201);
    });

    test('Get Conversation', async ({ client }) => {
        const marinUser = await User.findByOrFail('email', 'marin@ake-app.com');

        const privateKeyEncrypted = (await User.findByOrFail('email', 'marin@ake-app.com')).privateKey;
        const password = 'secret';
        const privateKey = CryptoJS.enc.Utf8.stringify(CryptoJS.AES.decrypt(privateKeyEncrypted, password));

        const response = await client
            .get('/conversations/get?offset=0')
            .session({ key: privateKey })
            .loginAs(marinUser);

        response.assertStatus(200);
        response.assertBodyContains({
            data: [],
            status: 'Ok',
        });
    });

    test('Search Conversation', async ({ client }) => {
        const marinUser = await User.findByOrFail('email', 'marin@ake-app.com');

        const privateKeyEncrypted = (await User.findByOrFail('email', 'marin@ake-app.com')).privateKey;
        const password = 'secret';
        const privateKey = CryptoJS.enc.Utf8.stringify(CryptoJS.AES.decrypt(privateKeyEncrypted, password));

        const response = await client
            .get('/conversations/search?query=louis&offset=0')
            .session({ key: privateKey })
            .loginAs(marinUser);

        response.assertStatus(200);
        response.assertBodyContains({
            data: [],
            status: 'Ok',
        });
    });
});
