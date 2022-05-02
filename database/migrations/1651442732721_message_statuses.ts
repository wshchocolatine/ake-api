import BaseSchema from '@ioc:Adonis/Lucid/Schema';

export default class MessageStatuses extends BaseSchema {
    protected tableName = 'message_statuses';

    public async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id').unsigned();
            table.string('user_id', 50).references('users.id').notNullable();
            table.string('message_id', 50).references('messages.id').notNullable();
            table.boolean('read').notNullable();

            /**
             * Uses timestamptz for PostgreSQL and DATETIME2 for MSSQL
             */
            table.timestamp('created_at', { useTz: true });
            table.timestamp('updated_at', { useTz: true });
        });
    }

    public async down() {
        this.schema.dropTable(this.tableName);
    }
}
