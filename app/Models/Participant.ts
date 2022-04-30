import { DateTime } from 'luxon';
import { BaseModel, BelongsTo, belongsTo, column } from '@ioc:Adonis/Lucid/Orm';
import User from './User';
import Conversation from './Conversation';

export default class Participant extends BaseModel {
    @column({ isPrimary: true })
    public id: number;

    @belongsTo(() => User, { foreignKey: 'userId' })
    public users: BelongsTo<typeof User>;

    @belongsTo(() => Conversation, {
        foreignKey: 'conversationId',
        serializeAs: 'conversation',
    })
    public conversations: BelongsTo<typeof Conversation>;

    @column()
    public userId: number;

    @column()
    public conversationId: number;

    @column.dateTime({ autoCreate: true })
    public createdAt: DateTime;
}
