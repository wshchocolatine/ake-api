import BaseSchema from '@ioc:Adonis/Lucid/Schema';

export default class Messages extends BaseSchema {
    protected tableName = 'messages';

    public async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.string('id', 50).primary();
            table.text('content').notNullable();
            table.string('author_id', 50).references('users.id').notNullable();
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