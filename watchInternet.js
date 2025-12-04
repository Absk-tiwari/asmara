const dns = require("dns");
const { switchToMySQL, switchToSQLite } = require("./db");

let currentDB = "mysql"; // default

function checkInternetConnection() {
  dns.lookup("google.com", (err) => {
    if (err && err.code === "ENOTFOUND") {
      if (currentDB !== "sqlite") {
        switchToSQLite();
        currentDB = "sqlite";
      }
    } else {
      if (currentDB !== "mysql") {
        switchToMySQL();
        currentDB = "mysql";
      }
    }
  });
}

// Run every 10 seconds
setInterval(checkInternetConnection, 10000);
