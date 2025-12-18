const express = require("express");
const Item = require('../models/Item');
const OrderDetail = require('../models/OrderDetail');
const CashRegister = require('../models/CashRegister');
const Customer = require('../models/Customer');
const router = express.Router();

const fetchuser= require('../middlewares/loggedIn');
const { getCurrentDate } = require("../utils");
let error = { status : false, message:'Something went wrong!' }


router.get('/items', fetchuser, async(req, res) => { // updated function
    try
    {
        let products;
        const cols = [
            'id',
            'name',
            'price',
            'category_id',
            'tax',
            'image',
            'stock',
            'thumb',
            'seq'
        ];

        if (req.body.category_id && req.body.category_id !== 'all') {
            products = await Item.query()
            .where('pos', true).where('category_id', req.body.category_id).orderBy('stock', 'desc').select(cols).withGraphFetched().modifyGraph('category', (builder) => {
                builder.select(
                    'menu_categories.name as catName'
                );
            });
        } else {
            products = await Item.query()
            .where('pos', true).orderBy('stock', 'desc').select(cols).withGraphFetched('category').modifyGraph('category', (builder) => {
                builder.select(
                    'menu_categories.name as catName'
                );
            });
        }

        return res.json({ 
            status:true, 
            products: products.map(({ category, ...rest }) => ({ 
                ...rest, 
                image: rest.thumb ? rest.thumb: rest.image,
                catName: category ? category.catName : null, 
                taxAmount: rest.tax && rest.tax!=='null'? (rest.price.replace(/\s+/g, '')?.replace(",",'.') * parseFloat(rest.tax) / 100).toFixed(2) : 0.00 
            }))
        })

    } catch (e) {
        error.message = e.message
        if (error.message.toLowerCase().includes('column')) {
            // await runCommand(`npx knex migrate:latest --cwd ${__dirname.replace('routes','')}`);
            return { status: false, relaunch:true, message: "Module installed, please restart." };
        }
        return res.status(400).json(error);
    }
});

// Route 3 : Get logged in user details - login required

router.post('/session', async(req, res)=> {

    const session_id = await OrderDetail.query()
    .where('cash_register_id', req.body.cash_register_id )
    .orderBy('id', 'desc')
    .first();
    return res.json({ session : session_id.session_id + 1 });

});

router.post('/opening-day-cash-amount', fetchuser, async(req, res) => {
    try {
        let created = await CashRegister.query().insert({
            opening_cash: req.body.cash,
            closing_cash: req.body.cash,
            date: getCurrentDate(),
            status: true,
            user_id: req.body.myID
        });
        return res.json({ status:true, created, message:"You can now start transactions!" });

    } catch (error) {
        return res.json({ status:false, message:error.message });
    }
});

router.get('/last-active-session', fetchuser, async(req, res)=> {
    try {
        const session = await CashRegister.query().where('user_id', req.body.myID).orderBy('id', 'desc').first();
        return res.json({ status:true, session });
    } catch (error) {
        console.log(error.message)
        return res.status(500).json({ status:false, reason:error.message });
    }
})

router.post('/create-customer', fetchuser, async (req, res )=> {
    try 
    {
        await Customer.query().insertAndFetch({
            name: req.body.name,
            email: req.body.email,
            phone: req.body.phone
        });
        const customers = await Customer.query().orderBy('id','desc').select(['id','name','email','phone']);

        return res.json({
            status:true,
            message: "Customer added!",
            customers
        });

    } catch (error) {
        console.log(error.message);
        return res.json({status:false, message: "Customer already exists!", exception: error.message });
    }

});

router.get('/customers', fetchuser, async (req,res) => {
    try {
        const customers = await Customer.query().orderBy(`id`,'desc').select(['id','name','phone','email']);
        return res.json(customers);
    } catch (error) {
        console.log(error)
    }
});

module.exports=router