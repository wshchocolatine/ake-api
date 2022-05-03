import BaseSchema from '@ioc:Adonis/Lucid/Schema';

export default class Users extends BaseSchema {
    protected tableName = 'users';

    public async up() {
        this.schema.createTable(this.tableName, (table) => {
            //Public Info
            table.string('id', 50).primary();
            table.string('username', 25).notNullable();
            table.integer('tag', 4).unsigned().notNullable();
            table.string('email', 320).unique().notNullable();
            table.string('description');
            //Private Info
            table.text('password').notNullable();
            table.text('private_key').notNullable();
            table.text('public_key').notNullable();
            //Date
            table.timestamp('created_at', { useTz: true });
            table.timestamp('updated_at', { useTz: true });
        });
    }

    public async down() {
        this.schema.dropTable(this.tableName);
    }
}
