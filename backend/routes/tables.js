const express = require("express");
const Table = require('../models/Table');
const router = express.Router();

let error = { status : false, message:'Something went wrong!' }
   
router.get('/', async (req,res) => {
    try {
        let cls = {
            free: 'success',
            reserved: 'primary',
            'order ongoing': 'warning'
        }
        const tables = await Table.query().select(['id', 'table_number', 'length','width', 'x', 'y', 'status', 'linked_to']);
        return res.json({
            status: true, 
            tables: tables.map( t => ({...t, className: cls[t.status]??'danger' })) 
        });

    } catch (e) {
      console.log("exception occured: ", e);
      error.message = e.message;
      return res.status(400).json(error);
    }
});

router.post('/update-position/:id', async(req,res) => {
    try {

        let update;
        if(req.params.id.indexOf('+')===-1) {
            update = await Table.query().patchAndFetchById(req.params.id, {
                x: req.body.x,
                y: req.body.y,
            });
        } else {
            update = await Table.query().patchAndFetchById((req.params.id).split("+")[1], {
                x: req.body.x,
                y: req.body.y,
            })
        }
        
        return res.json({ status:true, message: "Position updated", update: {...update, id: req.params.id} });

    } catch (err) {
        console.log(err.message);
        return res.status(500).json({ ...error, message: err.message });
    }
});

router.get('/free', async(req,res) => {
    await Table.query().patch({
        status: 'free'
    });
    return res.json({
        status: true
    })
});

router.get('/split-table/:table_number', async(req,res) => {
    try 
    {
        const tables = req.params.table_number.split('+');
        const updated = await Table.query().whereIn('linked_to', tables).patch({
            linked_to : null
        });

        await Table.query().whereIn('table_number', tables ).update({
            status:"free"
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

module.exports = router