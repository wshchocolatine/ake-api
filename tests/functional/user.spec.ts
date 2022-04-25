import { test } from '@japa/runner'
import User from 'App/Models/User'


/**
 * Testing everything about user account
 * Marin user has been created in seeds (/database/seeders/UserAndConversation.ts)
 */

test.group('User', () => {
  test('Informations about your account', async ({ client }) => {
    const marinUser = await User.findByOrFail('email', 'marin@ake-app.com')
  
  
    const response = await client.get('/user/account').loginAs(marinUser)
  
    response.assertStatus(200)
    response.assertBodyContains({ data: {}, status: 'Ok'})
  })

  test('Infomations about an other account', async ({ client }) => {
    const marinUser = await User.findByOrFail('email', 'marin@ake-app.com')
    const other_user = await User.findByOrFail('email', 'louis@ake-app.com')

    const url = '/user/other/account?userId=' + other_user.id
    const response = await client.get(url).loginAs(marinUser)

    response.assertStatus(200) 
    response.assertBodyContains({ data: {}, status: 'Ok'})
  })  
})
