import { test } from '@japa/runner'
import User from 'App/Models/User'

test.group('Conversations', () => {
  test('New', async({ client }) => {
    let user = await User.findByOrFail('email', 'marin@ake-app.com')
    let userBis = await User.findByOrFail('email', 'louis@ake-app.com')

    let payload = {
      receiver_username: userBis.username, 
      receiver_tag: userBis.tag, 
      content: 'Hey, first message :))'
    }

    let response = await client.post('/conversations/new').form(payload).loginAs(user)

    response.assertStatus(201)
  })

  /**
   *  These routes cannot be tested because we need private key
   */

  // test('Get', async({ client }) => {
  //   let user = await User.findByOrFail('email', 'marin@ake-app.com')

  //   let response = await client.get('/conversations/get?offset=0').loginAs(user)

  //   response.assertStatus(200)
  //   response.assertBodyContains({
  //     data: {}, 
  //     status: 'ok'
  //   })
  // })

  // test('Search', async({ client }) => {
  //   let user = await User.findByOrFail('email', 'marin@ake-app.com')

  //   let response = await client.get('/conversations/search?query=louis').loginAs(user)

  //   response.assertStatus(200)
  //   response.assertBodyContains({
  //     data: {}, 
  //     status: 'ok'
  //   })
  // })
})
