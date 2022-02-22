import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class Keys extends BaseSchema {
  protected tableName = 'keys'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.bigInteger('conversation_id').notNullable().unsigned().references('conversations.id')
      table.bigInteger('owner_id').notNullable().unsigned().references('users.id')
      table.text('key_encrypted').notNullable()
      table.string('iv').notNullable()
      /**
       * Uses timestamptz for PostgreSQL and DATETIME2 for MSSQL
       */
      //table.timestamp('created_at', { useTz: true })
      table.timestamp('created_at', { useTz: true })
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
