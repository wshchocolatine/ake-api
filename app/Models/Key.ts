import { BaseModel, BelongsTo, belongsTo, column } from '@ioc:Adonis/Lucid/Orm'
import { DateTime } from 'luxon'
import Conversation from './Conversation'
import User from './User'

export default class Key extends BaseModel {
  @belongsTo(() => User, { foreignKey: 'ownerId' })
  public users: BelongsTo<typeof User>

  @belongsTo(() => Conversation, { foreignKey: 'conversationId' })
  public conversations: BelongsTo<typeof Conversation>

  @column({ isPrimary: true })
  public id: number

  @column()
  public conversationId: number

  @column()
  public ownerId: number

  @column()
  public keyEncrypted: string

  @column()
  public iv: string

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime
}
