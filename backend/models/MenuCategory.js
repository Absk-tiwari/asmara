const { Model } = require('objection');

class MenuCategory extends Model {
    static get tableName() {
        return 'menu_categories';
    }
    static get relationMappings() {
        const Item = require('./Item');
        return {
            products: {
                relation: Model.HasManyRelation,
                modelClass: Item,
                join: {
                    from: 'menu_categories.id',
                    to: 'menu_items.category_id',
                }
            }
        };
    }
}

module.exports = MenuCategory;
