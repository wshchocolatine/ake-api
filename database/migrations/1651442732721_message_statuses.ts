import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class MessageStatuses extends BaseSchema {
  protected tableName = 'message_statuses'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').unsigned()
      table.bigint('owner_id').unsigned().references('users.id')
      table.bigint('message_id').unsigned().references('messages.id')
      table.boolean('read')

      /**
       * Uses timestamptz for PostgreSQL and DATETIME2 for MSSQL
       */
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
