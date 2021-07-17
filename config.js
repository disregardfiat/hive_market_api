require('dotenv').config();
const ENV = process.env;

exports.PORT = ENV.PORT || 3000;
exports.clientURL = ENV.CLIENTURL || "https://rpc.ecency.com/"  // 'http://127.0.0.1:8091/' //Run from same machine.
exports.CACHEMILSEC = ENV.CACHEMILSEC || 60000 //1 minute