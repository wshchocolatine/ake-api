import BaseSchema from '@ioc:Adonis/Lucid/Schema';

export default class Conversations extends BaseSchema {
    protected tableName = 'conversations';

    public async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.bigIncrements('id').unsigned();
            table.text('last_msg_content');
            table.bigInteger('last_msg_author').unsigned();
            table.bigInteger('last_msg_id');
            table.boolean('last_msg_read');
            table.timestamp('created_at', { useTz: true });
            table.timestamp('updated_at', { useTz: true });
        });
    }

    public async down() {
        this.schema.dropTable(this.tableName);
    }
}
