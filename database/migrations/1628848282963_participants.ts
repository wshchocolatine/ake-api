import BaseSchema from '@ioc:Adonis/Lucid/Schema';

export default class Participants extends BaseSchema {
    protected tableName = 'participants';

    public async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table.string('user_id', 50).references('users.id').notNullable();
            table.string('conversation_id', 50).references('conversations.id').notNullable();

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
