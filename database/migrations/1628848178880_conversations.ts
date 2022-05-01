import BaseSchema from '@ioc:Adonis/Lucid/Schema';

export default class Conversations extends BaseSchema {
    protected tableName = 'conversations';

    public async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id').unsigned()
            table.bigint('creator_id').unsigned().references('users.id')
            table.bigint('first_message_id').unsigned()
            table.timestamp('created_at', { useTz: true });
            table.timestamp('updated_at', { useTz: true });
        });
    }

    public async down() {
        this.schema.dropTable(this.tableName);
    }
}
