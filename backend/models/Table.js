const { Model } = require('objection');

class Table extends Model {
  static get tableName() {
    return 'tables'; 
  }
}

module.exports = Table;
