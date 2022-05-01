import { DateTime } from 'luxon';
import { BaseModel, BelongsTo, belongsTo, column, HasMany, hasMany } from '@ioc:Adonis/Lucid/Orm';
import Conversation from './Conversation';
import User from './User';
import MessageStatus from './MessageStatus';

export default class Message extends BaseModel {
    @hasMany(() => MessageStatus, { foreignKey: 'messageId'})
    public messageStatuses: HasMany<typeof MessageStatus>
    
    @belongsTo(() => Conversation, { foreignKey: 'conversationId' })
    public conversations: BelongsTo<typeof Conversation>;

    @belongsTo(() => User, { foreignKey: 'author' })
    public users: BelongsTo<typeof User>;

    @column({ isPrimary: true })
    public id: number;

    @column()
    public author: number;

    @column()
    public conversationId: number;

    @column()
    public content: string;

    @column.dateTime({ autoCreate: true })
    public createdAt: DateTime;
}
