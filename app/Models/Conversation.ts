import { DateTime } from 'luxon';
import { BaseModel, column, HasMany, hasMany, belongsTo, BelongsTo, } from '@ioc:Adonis/Lucid/Orm';
import Participant from './Participant';
import Key from './Key';
import Message from './Message';
import User from './User';

export default class Conversation extends BaseModel {
    @hasMany(() => Key, { foreignKey: 'conversationId' })
    public keys: HasMany<typeof Key>;

    @hasMany(() => Message, { foreignKey: 'conversationId' })
    public messages: HasMany<typeof Message>;

    @hasMany(() => Participant, { foreignKey: 'conversationId' })
    public participants: HasMany<typeof Participant>;

    @belongsTo(() => User, { foreignKey: 'creatorId' })
    public users: BelongsTo<typeof User>

    @column({ isPrimary: true })
    public id: string;

    @column({ serializeAs: null })
    public creatorId: string; 

    @column({ serializeAs: null })
    public firstMessageId: string;

    @column.dateTime({ autoCreate: true })
    public createdAt: DateTime;

    @column.dateTime({ autoCreate: true, autoUpdate: true })
    public updatedAt: DateTime;
}
