import { test } from '@japa/runner'
import faker from '@faker-js/faker'
import User from 'App/Models/User'

test.group('Auth', () => {
  test('Register', async ({ client }) => {
    let payload = {
      username: faker.internet.userName(), 
      email: faker.internet.email(), 
      password: 'abcdeF*1', 
      description: faker.lorem.sentence()
    }

    console.log(payload)

    let response = await client.post('/register').form(payload)

    response.assertStatus(201)
  }) 

  test('Login', async ({ client }) => {
    let payload = {
      email: 'marin@ake-app.com', 
      password: 'secret'
    }

    let response = await client.post('/login').form(payload)

    response.assertStatus(201)
  })

  test('Logout', async ({ client }) => {
    let user = await User.findByOrFail('email', 'marin@ake-app.com')

    let response = await client.get('/logout').loginAs(user)

    response.assertStatus(201)
  })

  test('Socket token', async ({ client }) => {
    let user = await User.findByOrFail('email', 'marin@ake-app.com')

    let response = await client.get('/user/token').loginAs(user)

    response.assertStatus(200)
    response.assertBodyContains({ data: {}, status: 'ok' })
  })
})
