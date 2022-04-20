import { test } from '@japa/runner'
import faker from '@faker-js/faker'
import User from 'App/Models/User'
import redis from '@ioc:Adonis/Addons/Redis'

test.group('Auth', async () => {
  test('Register', async ({ client }) => {
    const payload = {
      username: faker.internet.userName(), 
      email: faker.internet.email(), 
      password: 'abcdeF*1', 
      description: faker.lorem.sentence()
    }

    const response = await client.post('/register?token=true').form(payload)

    response.assertStatus(201)
    response.assertBodyContains({ data: {}, status: 'Created' })
  }) 

  test('Login', async ({ client }) => {
    const payload = {
      email: 'marin@ake-app.com', 
      password: 'secret'
    }

    const response = await client.post('/login?token=true').form(payload)

    response.assertStatus(201)
    response.assertBodyContains({ data: {}, status: 'Created' })
  })

  test('Logout', async ({ client }) => {
    const user = await User.findByOrFail('email', 'marin@ake-app.com')

    const response = await client.get('/logout').loginAs(user)

    response.assertStatus(201)
  })

  test('Socket token', async ({ client }) => {
    const user = await User.findByOrFail('email', 'marin@ake-app.com')

    const response = await client.get('/user/token').loginAs(user)

    response.assertStatus(201)
    response.assertBodyContains({ status: 'Created', data: {} })
  })

  await redis.flushall()
})
