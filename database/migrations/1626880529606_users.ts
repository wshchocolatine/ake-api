import BaseSchema from '@ioc:Adonis/Lucid/Schema';

export default class Users extends BaseSchema {
    protected tableName = 'users';

    public async up() {
        this.schema.createTable(this.tableName, (table) => {
            //Public Info
            table.bigIncrements('id').unsigned();
            table.string('username', 25);
            table.integer('tag', 4).unsigned();
            table.string('email', 320);
            table.string('description');
            //Private Info
            table.text('password');
            table.text('private_key');
            table.text('public_key');
            //Date
            table.timestamp('created_at', { useTz: true });
            table.timestamp('updated_at', { useTz: true });
        });
    }

    public async down() {
        this.schema.dropTable(this.tableName);
    }
}
