import BaseSchema from '@ioc:Adonis/Lucid/Schema';

export default class Messages extends BaseSchema {
    protected tableName = 'messages';

    public async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.bigIncrements('id').unsigned();
            table.text('content');
            table.bigInteger('author_id').unsigned().references('users.id');
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