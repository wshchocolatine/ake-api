// import { test } from '@japa/runner'
// import User from 'App/Models/User'
// import Conversation from 'App/Models/Conversation'
// import faker from '@faker-js/faker'

/**
 * These routes can't be test because we need private key in session
 */

// test.group('Messages', () => {
//   test('Send', async ({ client }) => {
//     const user = await User.findByOrFail('email', 'marin@ake-app.com')

//     const user_conversations = await Conversation.query()
//       .preload('participants', (subquery) => subquery.select('user_id').whereNot('user_id', user.id))
//       .whereHas('participants', (subquery) => subquery.where('user_id', user.id))
//       .orderBy('updated_at', 'desc')
//       .limit(1)
    
//     const payload = {
//       conv_id: user_conversations[0].id, 
//       content: faker.lorem.paragraph()
//     }

//     const response = await client.post('/message/send').form(payload).loginAs(user)

//     response.assertStatus(201)
//   })

//   test('Get', async ({ client }) => {
//     const user = await User.findByOrFail('email', 'marin@ake-app.com')
    
//     const user_conversations = await Conversation.query()
//       .preload('participants', (subquery) => subquery.select('user_id').whereNot('user_id', user.id))
//       .whereHas('participants', (subquery) => subquery.where('user_id', user.id))
//       .orderBy('updated_at', 'desc')
//       .limit(1)

//     const response = await client.get('/message/get?conv_id=' + user_conversations[0].id + '&offset=0').loginAs(user)

//     response.assertStatus(200)
//     response.assertBodyContains({
//       data: {}, 
//       status: 'ok'
//     })
//   })
// })
