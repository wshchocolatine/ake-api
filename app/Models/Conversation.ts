import { DateTime } from 'luxon'
import { BaseModel, column, HasMany, hasMany } from '@ioc:Adonis/Lucid/Orm'
import Participant from './Participant'
import Key from './Key'
import Message from './Message'

export default class Conversation extends BaseModel {
  @hasMany(() => Key, { foreignKey: 'conversation_id' })
  public keys: HasMany<typeof Key>

  @hasMany(() => Message, { foreignKey: 'conversation_id' })
  public messages: HasMany<typeof Message>

  @hasMany(() => Participant, { foreignKey: 'conversation_id' })
  public participants: HasMany<typeof Participant>

  @column({ isPrimary: true })
  public id: number

  @column()
  public last_msg_content: string

  @column()
  public last_msg_author: number

  @column()
  public last_msg_read: boolean

  @column()
  public last_msg_id: number

  @column.dateTime({autoCreate: true})
  public createdAt: DateTime

  @column.dateTime({autoCreate: true, autoUpdate: true})
  public updatedAt: DateTime
}
