import { test } from '@japa/runner';

test('display welcome page', async ({ client }) => {
    const response = await client.get('/');

    response.assertStatus(200);
    response.assertTextIncludes("Hey!! Welcome to Ake's api. Hope you will enjoy the trip :)");
});
