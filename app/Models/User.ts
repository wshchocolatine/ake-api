import { DateTime } from 'luxon';
import { BaseModel, beforeSave, beforeUpdate, column, HasMany, hasMany } from '@ioc:Adonis/Lucid/Orm';
import Hash from '@ioc:Adonis/Core/Hash';
import Participant from './Participant';
import Key from './Key';
import Message from './Message';
import CryptoJS from 'crypto-js';
import Conversation from './Conversation';

export default class User extends BaseModel {
    @hasMany(() => Participant, { foreignKey: 'userId' })
    public participants: HasMany<typeof Participant>;

    @hasMany(() => Key, { foreignKey: 'ownerId' })
    public keys: HasMany<typeof Key>;

    @hasMany(() => Message, { foreignKey: 'authorId' })
    public messages: HasMany<typeof Message>;

    @hasMany(() => Conversation, { foreignKey: 'creatorId' })
    public conversations: HasMany<typeof Conversation>;

    @column({ isPrimary: true })
    public id: string;

    @column()
    public username: string;

    @column()
    public tag: number;

    @column()
    public email: string;

    @column({ serializeAs: null })
    public password: string;

    @column()
    public description: string;

    @column({ serializeAs: null })
    public privateKey: string;

    @column({ serializeAs: null })
    public publicKey: string;

    @column.dateTime({ autoCreate: true, serializeAs: null })
    public createdAt: DateTime;

    @column.dateTime({ autoCreate: true, autoUpdate: true, serializeAs: null })
    public updatedAt: DateTime;

    @beforeSave()
    public static async hashPassword(user: User) {
        if (user.$dirty.password) {
            user.privateKey = CryptoJS.AES.encrypt(user.privateKey, user.password).toString();
            user.password = await Hash.make(user.password);
        }

        if (user.description === '') {
            user.description = 'Hey !';
        }
    }

    @beforeUpdate()
    public static async thingsBeforeUpdate(user: User) {
        if (user.$dirty.password) {
            user.privateKey = CryptoJS.AES.encrypt(user.privateKey, user.password).toString();
            user.password = await Hash.make(user.password);
        }
    }
}
