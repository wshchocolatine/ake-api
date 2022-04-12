import { DateTime } from 'luxon'
import { BaseModel, beforeSave, beforeUpdate, column, HasMany, hasMany } from '@ioc:Adonis/Lucid/Orm'
import Hash from '@ioc:Adonis/Core/Hash'
import Participant from './Participant'
import Key from './Key'
import Message from './Message'
import CryptoJS from "crypto-js"

export default class User extends BaseModel {
  @hasMany(() => Participant, { foreignKey: 'user_id' })
  public participants: HasMany<typeof Participant>

  @hasMany(() => Key, { foreignKey: 'owner_id' })
  public keys: HasMany<typeof Key>

  @hasMany(() => Message, { foreignKey: 'author' })
  public messages: HasMany<typeof Message> 

  @column({ isPrimary: true })
  public id: number

  @column()
  public username: string

  @column()
  public tag: number

  @column({ serializeAs: null })
  public email: string

  @column({ serializeAs: null })
  public password: string

  @column()
  public description: string

  @column({ serializeAs: null })
  public private_key: string

  @column({ serializeAs: null })
  public public_key: string

  @column.dateTime({ autoCreate: true, serializeAs: null })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, serializeAs: null })
  public updatedAt: DateTime

  @beforeSave()
  public static async hashPassword(user: User) {
    if (user.$dirty.password) {
      user.private_key = CryptoJS.AES.encrypt(user.private_key, user.password).toString()
      user.password = await Hash.make(user.password)
    }

    if(user.description === "") {
      user.description = 'Hey !'
    }
  }

  @beforeUpdate()
  public static async thingsBeforeUpdate(user: User) {
    if (user.$dirty.password) {
      user.private_key = CryptoJS.AES.encrypt(user.private_key, user.password).toString()
      user.password = await Hash.make(user.password)
    }
  }
}
