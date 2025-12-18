const express = require("express");
const Table = require('../models/Table');
const Order = require('../models/Order');
const Reservation = require('../models/Reservation');
const router = express.Router();

let error = { status: false, message: 'Something went wrong!' }

router.get('/', async (req, res) => {
    try {
        let cls = {
            free: 'success',
            reserved: 'primary',
            'order ongoing': 'warning'
        }
        const tables = await Table.query().select(['id', 'table_number', 'length', 'width', 'x', 'y', 'status', 'linked_to']);
        return res.json({
            status: true,
            tables: tables.map(t => ({ ...t, className: cls[t.status] ?? 'danger' }))
        });

    } catch (e) {
        console.log("exception occured: ", e);
        error.message = e.message;
        return res.status(400).json(error);
    }
});


router.get('/reservations', async (req, res) => {
    try {
        const reservations = await Reservation.query().select('*');
        return res.json({
            status: true,
            reservations
        });

    } catch (e) {
        console.log("exception occured: ", e);
        error.message = e.message;
        return res.status(400).json(error);
    }
});



router.post('/update-position/:table', async (req, res) => {
    try {

        let tables = req.params.table.split('+');

        const updated = await Table.query().whereIn('table_number', tables).patch({
            x: req.body.x,
            y: req.body.y,
        });

        return res.json({ status: true, message: "Position updated", update: updated });

    } catch (err) {
        console.log(err.message);
        return res.status(500).json({ ...error, message: err.message });
    }
});

router.get('/split-table/:table_number', async (req, res) => {
    try {
        const tables = req.params.table_number.split('+');
        const updated = await Table.query().whereIn('table_number', tables).patch({
            linked_to: null
        });

        const order = await Order.query().where('tables', req.params.table_number).first();
        if (order && order.status === 'ongoing') {
            await Order.query().deleteById(order.id);
        }

        await Table.query().whereIn('table_number', tables).update({
            status: "free"
        });

        return res.json({
            status: true,
            message: "Tables freed",
            updated
        });

    } catch (error) {
        console.log(error.message);
        return res.json({
            status: false,
            message: error.message
        })
    }
});

router.get('/free-all', async (req, res) => {
    try {
        await Table.query().patch({
            status: 'free'
        });
        return res.json({
            status: true,
            message: "Tables are free"
        })
    } catch (error) {
        return res.json({
            status: false,
            message: error.message
        })
    }
})
module.exports = router