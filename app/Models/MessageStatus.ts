import { DateTime } from 'luxon';
import { BaseModel, belongsTo, BelongsTo, column } from '@ioc:Adonis/Lucid/Orm';
import User from './User';
import Message from './Message';

export default class MessageStatus extends BaseModel {
    @belongsTo(() => User, { foreignKey: 'userId' })
    public users: BelongsTo<typeof User>;

    @belongsTo(() => Message, { foreignKey: 'messageId' })
    public messages: BelongsTo<typeof Message>;

    @column({ isPrimary: true })
    public id: number; 

    @column()
    public userId: number; 

    @column()
    public conversationId: number; 

    @column.dateTime({ autoCreate: true })
    public createdAt: DateTime; 

    @column.dateTime({ autoCreate: true, autoUpdate: true })
    public updatedAt: DateTime
}