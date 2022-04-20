import { test } from '@japa/runner'
import User from 'App/Models/User'

test.group('User', () => {
  test('Informations about your account', async ({ client }) => {
    const user = await User.findByOrFail('email', 'marin@ake-app.com')
  
  
    const response = await client.get('/user/account').loginAs(user)
  
    response.assertStatus(200)
    response.assertBodyContains({ data: {}, status: 'Ok'})
  })

  test('Infomations about an other account', async ({ client }) => {
    const user = await User.findByOrFail('email', 'marin@ake-app.com')
    const other_user = await User.findByOrFail('email', 'louis@ake-app.com')

    const url = '/user/other/account?user_id=' + other_user.id
    const response = await client.get(url).loginAs(user)

    response.assertStatus(200) 
    response.assertBodyContains({ data: {}, status: 'Ok'})
  })  
})
