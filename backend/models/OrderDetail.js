const { Model } = require('objection');

class OrderDetail extends Model {
  static get tableName() {
    return 'order_details'; // Corresponds to the table name in your database
  }
}

module.exports = OrderDetail;
