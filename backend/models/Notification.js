const { Model } = require('objection');

class Notification extends Model {
  static get tableName() {
    return 'notifications'; // Corresponds to the table name in your database
  }
}

module.exports = Notification;
