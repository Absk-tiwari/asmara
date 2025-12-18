require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const {knex} = require('./db');
const app = express();
const port = 5101;
const buildPath = path.join(__dirname, 'client/build');

app.use(cors());
app.use(express.json());
app.use('/images', express.static(path.join(__dirname, 'tmp')));
app.use(express.static(buildPath));

app.use("/auth", require("./routes/auth"));
app.use("/tables", require("./routes/tables"));
app.use("/menu", require("./routes/menu"));
app.use("/items", require("./routes/items"));
app.use("/orders", require("./routes/orders"));
app.use("/pos", require("./routes/pos"));
app.use("/tax", require("./routes/tax"));
app.use("/config", require("./routes/config"));
 
app.get('/install-update', async(req, res)=> {
    try {
        const fs = require('fs');
        const axios = require('axios')
        const url = 'https://asmara-eindhoven.nl/api/updates/download';
        const outputFolder = path.join( __dirname, './tmp' );
        const outputPath = path.join( outputFolder, 'update.zip' );
        // Download and save file
        const {data} = await axios({ method: 'GET', url, responseType: 'stream' })
        const writer = fs.createWriteStream(outputPath)
        data.pipe(writer)
        writer.on('finish', async () => {
            const data = await extractZip(outputPath, path.join(__dirname,'client'))
            fs.unlinkSync(outputPath)
            if(!data.status) {
                return res.json(data);
            }
            // return res.json({status:true, message: 'UI update installed!'});
            backendupdate(req,res);
        })
        
        writer.on('error', () => res.json({status:false, message: 'Failed downloading update!'}))

    } catch (error) {
        return res.json({status:false, message: error.message});
    }
})

async function backendupdate(req,res) {
    let extractPath
    try {
        const fs = require('fs')
        const axios = require('axios')
        const url = 'https://asmara-eindhoven.nl/api/backend-updates/download'
        const outputFolder = path.join(__dirname, './tmp')
        const outputPath = path.join(outputFolder, 'main.zip')

        const {data} = await axios({
            method: 'GET',
            url,
            responseType: 'stream'
        })
        const writer = fs.createWriteStream(outputPath);
        data.pipe(writer);
        writer.on('finish', async() => {
            const data = await extractZip(outputPath, path.join( __dirname, '../'))
            fs.unlinkSync(outputPath)
            if(!data.status) {
                return res.json(data);
            }
            return res.json({ status:true, message:"UX Updates installed!"});
        });
        writer.on('error', err => {
            return res.json({status:false, message:"Updates installation failed!", fileWritingReason: err.message })
        });

    } catch (er) {
        return res.json({ status:false, message: er.message, pathAtouter:extractPath, cpath: __dirname })
    }
}

app.get(`/install-backend-update`, async(req,res) => {
    backendupdate(req,res);
})

async function extractZip(source, destination) {
    try {
        const AdmZip = require('adm-zip');
        const zip = new AdmZip(source);
        zip.extractAllTo(destination, true); 
        return { status: true, message: "Update finished!" };
    } catch (error) {
        if (error.message.includes('Cannot find module')) {
            return { status: false, message: "adm-zip module missing, please install." };
        }
        return { status: false, message: error.message };
    }
}

app.get('/check-connection', async(req,res) => knex().raw('SELECT 1')
.then(() => res.json({status:true, message: '✅ Database connected successfully!'}))
.catch((err) => res.json({status:false, message: '❌ Database connection failed'})))


let server
function start(){
    server = app.listen(port)
    server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            console.error(`❌ Port ${port} is already in use.`);
            process.exit(1); // Exit the process
        } else {
            console.error("Server error:", err);
        }
    });
}

function stop(){
  server.close()
}

module.exports = { start, stop }