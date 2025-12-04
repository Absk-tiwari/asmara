const router = require("express").Router();
const User = require('../models/User');
const Table = require('../models/Table');
const Order = require('../models/Order');
const Product = require('../models/Item');
const CashRegister = require('../models/CashRegister');
const fetchuser= require('../middlewares/loggedIn');
const Report = require('../models/Report');
const storage = require('../utils/storage');
const { format } = require('date-fns');
const path = require('path');
const pdf = require('html-pdf');
const fs = require('fs');
const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');

dayjs.extend(relativeTime);

const { generatePdf, europeanDate } = require('../utils');
const imgPath = path.join(__dirname,'../client/build/static/media/logo.2d2e09f65e21f53b1f9f.png');

let b64;

let error = { status : false, message:'Something went wrong!' }

router.get('/', fetchuser , async(req, res) => {

    const orders = await Order.query() // where('user_id', req.body.myID)
    .withGraphFetched('[cashier(selectName), register]')
    .modifiers({
        selectName(build) {
            build.select('id', 'name');
        }
    })
    .orderBy('created_at', 'desc');

    // below code was for multi-user POS its not been in use from a while
    // let me = await User.query().where('id', req.body.myID ).first();
    // if(me.type == 'admin') {
    //     orders.orderBy('id', 'desc'); 
    // } else {
    //     orders.where('cashier_id', me.id ).orderBy('id', 'desc');
    // }
    
    let prs = await Product.query().select('id','name');
    let products = {};
    prs.forEach( pr => {
        products[pr.id] = pr.name;
    });

    let options = [];
    const sessions = await CashRegister.query().select(['id','date']).groupBy('date');
    sessions.forEach( s => {
        options.push({
            value: s.id,
            label: s.date
        });
    });

    let tableOrders = {};
    orders.forEach( order => {
        if(order.status==='ongoing' || order.status === 'in-kitchen') {
            tableOrders[order.tables] = {
                id: order.id,
                data: JSON.parse(order.data??'{}'),
                status: order.status,
                total: order.total
            };
        }
        // continue;
    });

    return res.json({
        status:true,
        orders: orders.map( o => ({...o, ago: dayjs(o.created_at).fromNow()})),
        products,
        sessions: options,
        tableOrders
    });

});

router.post('/create', fetchuser, async(req, res) => 
{ 
    try 
    {
        let lastSession = await CashRegister.query().where('status', true).select('id').first().orderBy('id','DESC');
        if(lastSession) {
            lastSession = lastSession.id;
        }
        const notifications = [];
        let modes = req.body.modes;

        if( (req.body.payment_mode).indexOf(',') !==-1 ) {
            modes = {...req.body.data, modes };
        } else {
            modes = req.body.data;
        }
        const order = await Order.query().patchAndFetchById(req.body.order_id,{
            // order_number: req.body.order_number,
            total: req.body.total,
            payment_mode: req.body.payment_mode,
            data: JSON.stringify(modes),
            cash_register_id: req.body.cash_register_id,
            payment_status: "paid",
            updated_at: europeanDate(),
        });

        if(order.status !== 'in-kitchen') {
            const tables = req.body.tables.split('+');
            await Table.query().whereIn('table_number', tables).update({
                status:"free"
            });
        }
        
        if (!order) {
            throw new Error('Error creating order');
        }

        if (req.body.data) 
        {
            await CashRegister.query().findById( lastSession ).patch({
                closing_cash: CashRegister.raw(`closing_cash + ?`, [ order.total ]),
            });

            return res.status(200).json({ 
                status: true,
                message: 'Transaction completed!',
                html: req.body.receiptData,
                order: {...order, ...modes},
                notifications
            });
            
        }

        return res.status(200).json({ status: false });

    } catch (error) {
        console.error('Transaction error:', error);
        res.status(500).json({ status: false, message: 'An error occurred', error: error.message });
    }
})

router.get('/link/:dragged/:target', fetchuser, async(req,res) => {
    try {

        const link = await Table.query().where('table_number', req.params.dragged).patch({
            linked_to: req.params.target
        });

        return res.json({
            status: true,
            message: "Tables merged!",
            link
        });

    } catch (error) {
        console.log(error);
        return res.json({
            status: false,
            message: error.message
        });
    }
});

router.get('/init/:table', fetchuser, async(req,res) => 
{
    try 
    {
        if((req.params.table).indexOf('+')===-1) {
            const table = await Table.query().where('table_number',req.params.table).first();
            if(table.status!== 'free') {
                return res.status(403).json({
                    status:false,
                    message:"Table is not available!",
                    table
                });
            }
        }
        
        const register = await CashRegister.query()
        .orderBy('id', "DESC")
        .where('user_id', req.body.myID )
        .where("status", true)
        .select('id')
        .first();

        const created = await Order.query().insert({
            customer_id: req.body.customer_id,
            cash_register_id: register.id,
            user_id: req.body.myID,
            tables: req.params.table,
            created_at: europeanDate()
        });

        const order = await Order.query().findById(created.id);

        const tables = req.params.table.split('+');

        await Table.query().whereIn('table_number', tables).update({
            status:"order ongoing"
        })

        return res.json({
            order
        });

    } catch (err) {

        console.log(err.message);
        return res.status(500).json({ ...error, exception: err.message });

    }

})

router.post('/to-kitchen/:table?', async(req,res) => {
    try {
        let payload = { status : 'in-kitchen' }

        if(req.body.data) {
            payload = {
                ...payload,
                data: JSON.stringify(req.body.data),
                total: req.body.total
            }
        }

        let order;
        if(req.body.order_id) {
            order = await Order.query().patchAndFetchById(req.body.order_id, payload);
        } else {
            order = await Order.query().insertAndFetch({...payload, note: "From direct sale.", created_at: Date.now() });
        }
        return res.json({ status:true, message:"Order sent to kitchen!", order });

    } catch (error) {
        console.log(error.message)
        return res.json({status:false})
    }
})

router.post('/payment-update', fetchuser, async(req,res) => {
    try {

        let modes = req.body.modes;
        if( (req.body.payment_mode).indexOf(',') !==-1 ) {
            modes = {...req.body.data, modes };
        } else {
            modes = req.body.data;
        }

        const order = await Order.query().findById(req.body.order_id).patch({
            payment_status:"paid", 
            updated_at: europeanDate(),
            data: modes
        });

        return res.json({
            status:true,
            message: "Payment completed!",
            order
        });

    } catch (error) {
        return res.json({status:false, exception: error.message, message: "An error occurred!"});
    }    
})

router.get('/view-order/:id', fetchuser, async(req, res) =>{
    try 
    { 
        let orderID = req.params.id;
        
        let order = await Order.query().where('id', orderID ).withGraphFetched('cashier').first();
        
        let data = typeof order.data ==='string' ? JSON.parse(order.data): order.data;
        const products = await Product.query().whereIn( 'id', data?.products );
        const pairs = {};
        products.forEach( pr => {
            pr.taxAmount = pr.tax && pr.tax!=='null'? (pr.price.replace(/\s+/g, '')?.replace(",",'.') * parseFloat(pr.tax) / 100).toFixed(2) : 0.00;
            pairs[pr.id] = pr;
        });

        return res.json({
            status: true,
            order,
            products: pairs,
            session:data,
            cashier: order.cashier
        });

    } catch (e) {
        
        error.message = e.message;
        console.log(e.message);
        return res.json({
            status: false,
            order:{},
            products: [],
            session: [],
        }) 

    }
});

router.get(`/last-order`, fetchuser, async(req,res) => {
    try // its updated don't look here 
    {
        let order = await Order.query().orderBy( "created_at", "DESC" ).withGraphFetched('cashier').first();
        const cashier = order.cashier;
        let data = JSON.parse(order.data);
        
        const products = await Product.query().whereIn('id', data.products);
        const pairs = {};
        products.forEach( pr => {
            pr.taxAmount = pr.tax && pr.tax!=='null'? (pr.price.replace(/\s+/g, '')?.replace(",",'.') * parseFloat(pr.tax) / 100).toFixed(2) : 0.00;
            pairs[pr.id] = pr;
        });

        return res.json({
            status: true,
            order,
            products: pairs,
            session:data,
            cashier
        });

    } catch (e) {

        error.message = e.message;
        console.log(e.message)
        return res.json({
            status: false,
            order:{},
            products: [],
            session: [],
        });

    }

})

router.post(`/x-report`, fetchuser, async(req,res) => {
    try {
        
        const payload = req.body;
        const { status, message, html } = await generateReport({ ...payload, type:'X' });
        return res.json({
            status,
            message,
            html
        });

    } catch (error) {
        return res.json({
            status:false, 
            message:error.message
        });
    }
});

router.post(`/z-report`, fetchuser, async(req,res) => {
    try {
        const payload = req.body;
        const {status, message, html, register_id} = await generateReport({...payload, type:'Z'})
        if(status){
            if(register_id) {
                await CashRegister.query().where('id', register_id).patch({
                    status:false
                });
            }
            await Table.query().patch({
                status: "free"
            });
        }
        res.json({ status, message, html});

    } catch (error) {
        console.log(error)
        res.json({status: false, message:error.message })
    }    
})

async function generateReport(payload) {

    let totalProducts = 0, total = 0, tax = 0, cash = 0, card = 0, account = 0, discounts = 0;
    let customers = [];
    let categories = {};
    let Rtype = payload.type;
    let lastRegisterID = null;

    let orders;
    if (payload.today) {
        
        const lastSession = await CashRegister.query().where('status', true).select('id').first().orderBy('id','DESC');
        if(lastSession) {
            lastRegisterID = lastSession.id
            orders = await Order.query()
            .where('cash_register_id', lastSession.id )
            .select('*');
        }

    } else {

        lastRegisterID = payload.register_id;
        orders = await Order.query().where('cash_register_id', payload.register_id).select('*'); // x-report always

    }
    // return {status:true, orders};

    let taxes = {}, qt = {};
    for (const order of orders) {

        if(order.data===null) continue; // ignore the pending orders
        let orderData = order.data;
        
            let products = Array.from(new Set(orderData.products));
            total += Number(orderData.total);
            let QT = orderData.quantity;
            let quickProduct = orderData.otherAmount || null;
            const sPrice = orderData.price || null // just rates to show category-wise
            
            for (const id of products) { // just rates to show category-wise
                
                if ( typeof id === 'string' && id.indexOf('quick')!== -1 ) {
                    categories['Others'] = categories['Others'] ? categories['Others'] + parseFloat(quickProduct): parseFloat(quickProduct);
                    qt['Others'] = (parseFloat(qt['Others']) || 0) + QT[id];
                    continue;
                }

                let product = await Product.query()
                .withGraphFetched('category')
                .findById(id)
                .select('category_id', 'price', 'tax');
    
                if (product?.tax) {
                    let [value, type] = product.tax.split(' ');
                    if (!taxes[type??'Other']) taxes[type??'Other'] = value;
                }
    
                if (!product?.category) {
                    categories['Others'] = categories['Others'] ? categories['Others'] + ((sPrice[id]??product.price) * QT[id]): ((sPrice[id]??product.price) * QT[id]);
                    qt['Others'] = (parseFloat(qt['Others']) || 0) + QT[id];
                } else {
                    categories[product.category.name] = (categories[product.category.name] || 0) + (sPrice?.[id]??product.price * QT[id]);
                    qt[product.category.name] = (parseInt(qt[product.category.name]) || 0 ) + QT[id];
                }
            }
    
            totalProducts += Object.values(QT).reduce((sum, qty) => sum + parseInt(qty), 0);
    
            let finalTax = await Product.query() // no worries for `added_by` here z id >>>> added_by
            .whereIn('id', products)
            .select(['tax','price','id']);
    
            let thisTax = finalTax.reduce((sum, item) => sum + (parseFloat(item.tax) / 100 * parseFloat(sPrice[item.id]??item.price)), 0);
            if(!isNaN(thisTax)) tax += thisTax;

            // discounts += finalTax.reduce((a,b) => a + (sPrice[b.id] - b.price),0);

            if (order.payment_mode === 'Cash') {
                cash += orderData.total;
            } else if (order.payment_mode === 'Card') {
                card += orderData.total;
            } else if(order.payment_mode === 'Account') {
                account+= orderData.total;
            } else {
                if(orderData.modes) {
                    const { Cash, Card, Account, ogCash } = orderData.modes;
                    cash += ogCash? parseFloat(ogCash): parseFloat(Cash);
                    card += parseFloat(Card);
                    account += parseFloat(Account);
                }
            }

        //
    }

    let me = await User.query().where('id', payload.myID ).first();
    let registerCash = await CashRegister.query().where('id', payload.register_id?? lastRegisterID ).first();

    // now we have the meta-data
    let data = {
        total_products: totalProducts,
        total_customers: customers.length,
        // return_amount: returns,
        total_tax: tax,
        total_amount: parseFloat(total),
        cash: parseFloat(cash),
        card: parseFloat(card),
        account: parseFloat(account),
        discounts:parseFloat(discounts),
        number_of_transactions: orders.length,
        categories,
        taxes,
        qt,
        Rtype,
        print: false,
        currency: '€ ',
        userName: me.name,
        b64:imgPath
    };

    if(registerCash) {
        data.register = {
            open: registerCash?.opening_cash??0 ,
            close: '€ ' + registerCash.closing_cash??0
        }
    };
    let view = await generatePdf(data); // Pass data to a template renderer
    const options = { format: 'A4' };

    if (Rtype === 'Z') {

        let path = `reports/${format(new Date(), 'dd_MM_yyyy')}_Z_report.pdf`;
        
        pdf.create(view, options).toBuffer(async(err, fileBuffer) => {
            if (err) {
                console.error(err);
            } else {
                await storage.put(path, fileBuffer);
            }
        });

        await Report.query().insert({
            path,
            date: europeanDate(),
            user_id: payload.myID,
            cash_register_id: lastRegisterID,
            html: view
        });
        
    } 
    
    return { 
        status: true,
        message: Rtype==='Z'? 'Z-report generated!'+ (payload.today ? ' Sessions are reset': ""):"X-report generated!",
        html: view,
        register_id: lastRegisterID
    };
    
}

router.get('/reports', fetchuser, async(req,res) => {
    try { // it is updated with user_id
        const reports = await Report.query().where('user_id', req.body.myID ).orderBy('id','desc');
        return res.json({status:true, reports})
    } catch (error) {
        return res.json({status:false, reports:[]})
    }
})

router.get('/day-close/:id', fetchuser, async(req,res)=> {
    try {
        await generateReport({
            register_id: req.params.id, 
            type: 'Z', 
            myID: req.body.myID,
            currency: '€ '
        });
        await CashRegister.query()
        .where('id', req.params.id )
        .patch({ status:false }) // marking it as inactive session now
        
        return res.json({ status:true });

    } catch (error) {
        console.log(error)
        return res.json({ status:false, message:error.message })
    }
})

router.get('/remove-report/:id', async(req,res) => {
    try {
        const report = await Report.query().findById(req.params.id);
        try {
            if(fs.existsSync(path.join(__dirname,'../tmp/'+report.path))) {
                fs.unlinkSync(path.join(__dirname,'../tmp/'+report.path));
            }
        } catch (error) {throw new Error("Failed to remove the file:"+error.message)}
        await Report.query().deleteById(req.params.id);
        return res.json({status:true, message:"Report removed!"});

    } catch (error) {
        return res.json({status:false})
    }
})

module.exports=router 