import { DateTime } from 'luxon';
import { BaseModel, column, HasMany, hasMany } from '@ioc:Adonis/Lucid/Orm';
import Participant from './Participant';
import Key from './Key';
import Message from './Message';

export default class Conversation extends BaseModel {
    @hasMany(() => Key, { foreignKey: 'conversationId' })
    public keys: HasMany<typeof Key>;

    @hasMany(() => Message, { foreignKey: 'conversationId' })
    public messages: HasMany<typeof Message>;

    @hasMany(() => Participant, { foreignKey: 'conversationId' })
    public participants: HasMany<typeof Participant>;

    @column({ isPrimary: true })
    public id: number;

    @column()
    public lastMsgContent: string;

    @column()
    public lastMsgAuthor: number;

    @column()
    public lastMsgRead: boolean;

    @column()
    public lastMsgId: number;

    @column.dateTime({ autoCreate: true })
    public createdAt: DateTime;

    @column.dateTime({ autoCreate: true, autoUpdate: true })
    public updatedAt: DateTime;
}
