const { Model } = require('objection');

class Item extends Model {
    static get tableName() {
        return 'menu_items'; // Corresponds to the table name in your database
    }
    static get relationMappings() {
        const MenuCategory = require('./MenuCategory');
        return {
            category: {
                relation: Model.BelongsToOneRelation,
                modelClass: MenuCategory,
                join: {
                    from: 'menu_items.category_id',
                    to: 'menu_categories.id',
                },
            },
        };
    }
}

module.exports = Item;
