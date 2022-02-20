import { DateTime } from 'luxon'
import { BaseModel, BelongsTo, belongsTo, column } from '@ioc:Adonis/Lucid/Orm'
import Conversation from './Conversation'
import User from './User'

export default class Message extends BaseModel {
  @belongsTo(() => Conversation, { foreignKey: 'conversation_id' })
  public conversations: BelongsTo<typeof Conversation>

  @belongsTo(() => User, { foreignKey: 'author' })
  public users: BelongsTo<typeof User>

  @column({ isPrimary: true })
  public id: number

  @column()
  public author: number

  @column()
  public conversation_id: number

  @column()
  public content: string

  @column()
  public read: boolean

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime
}
