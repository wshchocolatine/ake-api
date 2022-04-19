import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import { UserFactory } from 'Database/factories'

export default class UserSeeder extends BaseSeeder {
  public async run () {
      await UserFactory
        .merge([
          {
            username: 'louis', 
            email: 'louis@ake-app.com'
          }, 
          {
            username: 'marin', 
            email: 'marin@ake-app.com'
          }, 
          {
            username: 'ake', 
            email: 'ake@ake-app.com'
          }
        ])
        .createMany(3)
  }
}
