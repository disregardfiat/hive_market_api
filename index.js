const config = require('./config');
const cors = require('cors');
const helmet = require('helmet');
const API = require('./api');
const express = require('express');
const api = express();
var http = require('http').Server(api);

api.use(API.https_redirect);
api.use(cors())
api.use(helmet())
api.get('/api/tickers', API.tickers);
api.get('/api/orderbook', API.orderbook);
api.get('/api/orderbook/:ticker_id', API.orderbook);
api.get('/api/pairs', API.pairs);
api.get('/api/historical_trades', API.historical_trades);
api.get('/api/historical_trades/:ticker_id', API.historical_trades);
api.get('/api/coin_detail', API.detail);

API.init().then(empty=>{
    http.listen(config.PORT, function() {
    console.log(`Wrapped Internal Market API listening on port ${config.PORT}`);
});
})
