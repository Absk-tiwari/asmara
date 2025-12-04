const { Model } = require('objection');

class User extends Model {
    static get tableName() {
      return 'users'; // Corresponds to the table name in your database
    }
    static get relationMappings() {
      const Application = require('./Application');
      return {
          application: {
              relation: Model.HasOneRelation,
              modelClass: Application,
              join: {
                  from: 'users.phone',
                  to: 'applications.phone',
              },
          },
      };
  }
}

module.exports = User;
