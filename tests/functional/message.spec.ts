import { test } from '@japa/runner'
import User from 'App/Models/User'
import Conversation from 'App/Models/Conversation'
import faker from '@faker-js/faker'
import CryptoJS from "crypto-js"


/**
 * Testing everything about messages routes
 * Marin and Louis user and their conversations with their messages have been created in seeds (/database/seeders/UserAndConversation.ts)
 */

test.group('Messages', () => {
  test('Send Message', async ({ client }) => {
    const marinUser = await User.findByOrFail('email', 'marin@ake-app.com')
    const louisUser = await User.findByOrFail('email', 'louis@ake-app.com')

    const privateKeyEncrypted = (await User.findByOrFail('email', 'marin@ake-app.com')).privateKey
    const password = 'secret'
    const privateKey  = CryptoJS.enc.Utf8.stringify(CryptoJS.AES.decrypt(privateKeyEncrypted, password))

    const user_conversations = await Conversation.query()
      .whereHas('participants', (subquery) => subquery.where('user_id', marinUser.id))
      .andWhereHas('participants', (subquery) => subquery.where('user_id', louisUser.id))
      .orderBy('updated_at', 'desc')
      .limit(1)
    
    const payload = {
      convId: user_conversations[0].id, 
      content: faker.lorem.paragraph()
    }

    const response = await client.post('/message/send').form(payload).session({ key: privateKey }).loginAs(marinUser)

    response.assertStatus(201)
  })

  test('Get Message', async ({ client }) => {
    const marinUser = await User.findByOrFail('email', 'marin@ake-app.com')
    const louisUser = await User.findByOrFail('email', 'louis@ake-app.com')
    
    const userConversations = await Conversation.query()
      .whereHas('participants', (subquery) => subquery.where('user_id', marinUser.id))
      .andWhereHas('participants', (subquery) => subquery.where('user_id', louisUser.id))
      .orderBy('updated_at', 'desc')
      .limit(1)

    
    const privateKeyEncrypted = (await User.findByOrFail('email', 'marin@ake-app.com')).privateKey
    const password = 'secret'
    const privateKey  = CryptoJS.enc.Utf8.stringify(CryptoJS.AES.decrypt(privateKeyEncrypted, password))

    const response = await client.get('/message/get?convId=' + userConversations[0].id + '&offset=0').session({ key: privateKey }).loginAs(marinUser)

    response.assertStatus(200)
  })
})
