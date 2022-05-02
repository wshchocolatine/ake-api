import BaseSchema from '@ioc:Adonis/Lucid/Schema';

export default class Keys extends BaseSchema {
    protected tableName = 'keys';

    public async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table.string('conversation_id', 50).references('conversations.id').notNullable()
            table.string('owner_id', 50).references('users.id').notNullable()
            table.text('key_encrypted').notNullable();
            table.string('iv').notNullable();
            /**
             * Uses timestamptz for PostgreSQL and DATETIME2 for MSSQL
             */
            //table.timestamp('created_at', { useTz: true })
            table.timestamp('created_at', { useTz: true });
        });
    }

    public async down() {
        this.schema.dropTable(this.tableName);
    }
}
