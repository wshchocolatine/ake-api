import BaseSchema from '@ioc:Adonis/Lucid/Schema';

export default class Conversations extends BaseSchema {
    protected tableName = 'conversations';

    public async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.string('id', 50).primary();
            table.string('creator_id', 50).references('users.id').notNullable();
            table.string('first_message_id', 50).unsigned().notNullable();
            table.timestamp('created_at', { useTz: true });
            table.timestamp('updated_at', { useTz: true });
        });
    }

    public async down() {
        this.schema.dropTable(this.tableName);
    }
}
