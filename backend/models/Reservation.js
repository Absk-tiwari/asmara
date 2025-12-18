const { Model } = require('objection');

class Report extends Model {
  static get tableName() {
    return 'reports'; // Corresponds to the table name in your database
  }

  static get relationMappings() {
    const Table = require('./Table');
    return {
        table: {
            relation: Model.BelongsToOneRelation,
            modelClass: Table,
            join: {
                from: "table_id",
                to: ""
            }
        }
    }
  }
}

module.exports = Report;
