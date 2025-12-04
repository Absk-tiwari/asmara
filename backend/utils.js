const normalizeSpaces = (str) => {
    return str.replace(/\s+/g, ' ').trim();
}

const getCurrentDate = (format='dmy') => {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0'); // Add leading zero if needed
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const year = date.getFullYear();
    if(format==='dmy') return `${day}-${month}-${year}`;
    return `${year}-${month}-${day}`
};

async function generatePdf(data){
    /*
        Below is a removed line:- 

        <tr><td><b>Discounts</b>:</td><td></td><td>${data.currency}${data.discounts < 0? 0.00: data.discounts.toFixed(2)}</td></tr>
    */ 
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: ${data.print ? "system-ui" : "cursive"}; }
            .chosen-product {align-items:center; min-height:80px; background-color: #fff;}
            .chosen-product .w-100{ justify-content: space-between; }
            .row.d-flex { justify-content:space-between; }
            @media (max-width:250px) {
                * { font-size: 10px; }
            }
            #receipt {
                width: calc(100vw + 6px);
                ${!data.print ? "border: 4px dashed gray; border-radius: 15px;" : ""}
            }
            .receipt { width:90%; background:#fff; margin-left:5%; }
            .head img { margin-left: calc(50% - 190px); }
            .head { border-bottom: 2px solid black; }
            .head p:first-child { border-bottom: 1px solid black; }
            .d-grid p { text-align: center; }
            .foot div:first-child { border-top: 1px dashed gray; }
            img { height:200px!important; width:380px!important; }
            .total { display: flex; justify-content: space-between; }
            .chosen-product { margin-top: 10px; }
            .chosen-product .w-100 { display: flex; justify-content:space-between; margin: 0!important; padding: 0!important; }
            .chosen-product p:not(:nth-child(3)) { padding: 0; margin:0!important; }
            .chosen-product:nth-child(3) {border-top: 1px dashed gray; padding-top:10px; }
            .chosen-product:nth-child(1) {border-bottom: 1px dashed gray; padding-bottom:10px; }
            @page { margin:0px!important; }
            ${data.print ? `
            body {
                width: auto!important;
                margin:20 auto;
                font-family: 'DejaVu Sans', sans-serif;
            }
            ` : ""}
        </style>
    </head>
    <body>
        <div class="d-grid" style="place-content: center; width:100%;">
            <div id="receipt" style="width:auto; border-radius: 15px; border:3px dashed gray;">
                <div style="background-color: white; padding-bottom:40px; border-radius:15px;">
                    <div class="row">
                        <div class="d-grid text-center w-100 head" style="justify-content:center; width:100%;">
                            <img src="data:image/png;base64,${data.b64}" style="height:50px;">
                            <p>${data.Rtype.toUpperCase()} - Report</p>
                        </div>
                    </div>
                    <div class="row">
                        <div class="receipt">
                            <div class="row mt-2 chosen-product">
                                <table style="width:100%; border-bottom:1px dashed gray">
                                    <tbody>
                                        ${data.register? 
                                            `<tr><td><b>Opening Cash</b>:</td><td></td><td>${data.register.open}</td></tr>
                                            <tr><td><b>Closing Cash</b>:</td><td></td><td>${data.register.close}</td></tr>`
                                        :``}
                                        <tr><td><b>Report Date</b>:</td><td></td><td>${new Date().toLocaleDateString()}</td></tr>
                                        <tr><td><b>Report Time</b>:</td><td></td><td>${new Date().toLocaleTimeString()}</td></tr>
                                        <tr><td><b>Transactions</b>:</td><td></td><td>${data.number_of_transactions}</td></tr>
                                        <tr><td><b>Total Products</b>:</td><td></td><td>${data.total_products}</td></tr>
                                        <tr><td><b>Returns</b>:</td><td></td><td>${data.return_amount < 0 ? '-'+data.currency+Math.abs(data.return_amount): data.currency+ data.return_amount}</td></tr>
                                        <tr><td><b>Cash Payments</b>:</td><td></td><td>${data.currency}${data.cash.toFixed(2)}</td></tr>
                                        <tr><td><b>Card Payments</b>:</td><td></td><td>${data.currency}${data.card.toFixed(2)}</td></tr>
                                        <tr><td><b>Account Payments</b>:</td><td></td><td>${data.currency}${data.account.toFixed(2)}</td></tr>
                                        <tr><td><b>Tax</b>:</td><td></td><td>${data.currency}${data.total_tax.toFixed(2)}</td></tr>
                                        <tr style="border-top:1px dashed gray">
                                            <td><b>Included Taxes</b></td>
                                        </tr>
                                        ${Object.entries(data.taxes).map(([type, value]) => `
                                        <tr>
                                            <td><b>${type}</b>:</td>
                                            <td></td>
                                            <td>${value}</td>
                                        </tr>`).join('')}
                                    </tbody>
                                </table>
                                <br/>

                            </div>
                            <div class="foot">
                                <div class="row d-flex">
                                    <div class="total">
                                        <h2>TOTAL</h2>
                                        <h2>${data.currency}${data.total_amount.toFixed(2)}</h2>
                                    </div>
                                </div>
                                <div class="row d-flex mt-0">
                                    <div>
                                        <small>Generated On</small>
                                        <small>${new Date().toLocaleString()}</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
}

/*
${ Object.values(data.categories).reduce((a,c)=> a + c ,0 ) !==0  ?`<b style="text-align:center">Department Sales</b>
    <div class="row chosen-product mb-0">
        <table style="width: 100%;">
            <thead>
                <tr>
                    <td><b>Type</b></td>
                    <td><b>Quantity</b></td>
                    <td><b>Amount</b></td>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(data.categories).reverse().map(([name, price]) => `
                <tr>
                    <td>${name}:</td>
                    <td>${data.qt[name] || ''}</td>
                    <td>${data.currency}${price.toFixed(2)}</td>
                </tr>`).join('')}
            </tbody>
        </table>
    </div>`: ``}
*/ 

async function runCommand(command) {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    try {
        const { stdout, stderr } = await execPromise(command);
        if (stderr) {
            return {output:`⚠️ Command executed with warnings: ${stderr}`};
        }        
        return {output:`✅ Command successful:\n${stdout}`};

    } catch (error) { 
        return {output:`❌ Command failed: ${error.message}`};
    }
}

async function uploadFile(filePath, uploadUrl, clientName) {
    const axios = require('axios');
    const fs = require('fs')
    const FormData = require("form-data");
    const path = require('path')
    try {
        const fileStream = fs.createReadStream(filePath);
        const formData = new FormData();
        formData.append("file", fileStream);
        formData.append("client", clientName);
        formData.append("path", path.resolve(__dirname, './database/db.sqlite'));

        const headers = {
            ...formData.getHeaders()
        };
        const {data} = await axios.post(uploadUrl, formData, { headers });

        return data.status;

    } catch (error) {
        console.error("Error uploading file:", error.message);
        if (error.message.includes('column')) {
            await runCommand(`npm install form-data dotenv`); 
            return { status: false, relaunch:true, message: "Module installed, please restart." };
        }
        return false
    }
}

function getRandomHexColor() {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}

function generateOrderId() {
  // Get current date in YYYYMMDD format
  const crypto = require('crypto');
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(now.getDate()).padStart(2, '0');

  // Generate a random 5-character alphanumeric string
  const randomStr = crypto.randomBytes(3).toString('hex').slice(0, 5).toUpperCase();

  return `ORD-${year}${month}${day}-${randomStr}`;
}

const europeanDate = () => new Date().toISOString("en-US", { timeZone: "Europe/Amsterdam" })

const uploadToServer = async (formData, axios) => {
    
    try {
        const {data} = await axios.post(process.env.SERVER_URL, formData, {
            headers:{ 
                "Accept"       :"application/json",
                "Content-Type" : "multipart/form-data",
            }
        });
        return data;

    } catch (error) {
        return {
            status:false,
            exception: error.message
        }
    }
}

const queueProduct = async (path, axios, request) => {
    try 
    {
        if(!request.header('Authorization')){
            return {
                status: false,
                message: "Application key not specified"
            };
        }
        const payload = {
            barCode: request.body.barcode?? request.body.code,
            name: request.body.name,
            price: request.body.price,
            quantity: request.body.quantity?? 5000,
            tax: request.body.tax??'0%',
            category: request.body.catName?? "",
            synced: true
        }
        const {data} = await axios.post(`${process.env.REMOTE_SERVER + path}`, payload, {
            headers: {
                "Accept": "application/json",
                "Authorization": request.header('Authorization')
            }
        })
        return data;

    } catch (error) {
        return {
            status:false,
            exception: error.message
        }
    }
}

module.exports = { 
    normalizeSpaces, 
    getCurrentDate, 
    generatePdf, 
    uploadFile, 
    getRandomHexColor, 
    europeanDate,
    uploadToServer,
    queueProduct,
    generateOrderId
};
