import BaseSchema from '@ioc:Adonis/Lucid/Schema';

export default class Participants extends BaseSchema {
    protected tableName = 'participants';

    public async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table.bigInteger('user_id').unsigned().references('users.id');
            table.bigInteger('conversation_id').unsigned().references('conversations.id');

            /**
             * Uses timestamptz for PostgreSQL and DATETIME2 for MSSQL
             */
            table.timestamp('created_at', { useTz: true });
        });
    }

    public async down() {
        this.schema.dropTable(this.tableName);
    }
}
