import { DateTime } from 'luxon'
import { BaseModel, BelongsTo, belongsTo, column } from '@ioc:Adonis/Lucid/Orm'
import User from './User'
import Conversation from './Conversation'

export default class Participant extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @belongsTo(() => User, { foreignKey: 'user_id' })
  public users: BelongsTo<typeof User>

  @belongsTo(() => Conversation, { foreignKey: 'conversation_id', serializeAs: 'conversation' })
  public conversations: BelongsTo<typeof Conversation>

  @column()
  public user_id: number

  @column()
  public conversation_id: number

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime
}
