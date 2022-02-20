import { BaseModel, BelongsTo, belongsTo, column } from '@ioc:Adonis/Lucid/Orm'
import Conversation from './Conversation'
import User from './User'

export default class Key extends BaseModel {
  @belongsTo(() => User, { foreignKey: 'owner_id' })
  public users: BelongsTo<typeof User>

  @belongsTo(() => Conversation, { foreignKey: 'conversation_id' })
  public conversations: BelongsTo<typeof Conversation>

  @column({ isPrimary: true })
  public id: number

  @column()
  public conversation_id: number

  @column()
  public owner_id: number

  @column()
  public key_encrypted: string

  @column()
  public iv: string
}
