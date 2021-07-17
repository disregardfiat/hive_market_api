let config = require('./config');
const fetch = require('node-fetch');

var RAM = {
    lastUpdate: 0,
    lastQuote: 0,
    lastUpdateMarket: 0,
    lastDayBucket: 0,
    lastBook: 0,
    Book: '',
    Hive: '',
    Ticker: '',
    Market: '',
    DayBucket: ''
}

exports.pairs = (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    const pairs = [
        {
            ticker_id: `HIVE_HBD`,
            base: "HIVE",
            target: "HBD",
        }
    ]
    res.send(JSON.stringify(pairs, null, 3))
}

exports.tickers = (req, res, next) => {
    var dex = fetchHiveDexCurrentPrice()
    res.setHeader('Content-Type', 'application/json');
    Promise.all([dex])
        .then(function(v) {
            var HIVE_HBD = {
                ticker_id: `HIVE_HBD`,
                base_currency: "HIVE",
                target_currency: "HBD",
                last_price: RAM.Ticker.latest,
                base_volume: parseFloat(parseInt(RAM.Ticker.hive_volume.amount)/1000).toFixed(3),
                target_volume: parseFloat(parseInt(RAM.Ticker.hbd_volume.amount)/1000).toFixed(3),
                bid: RAM.Ticker.highest_bid,
                ask: RAM.Ticker.lowest_ask,
                high: RAM.High,
                low: RAM.Low
            }
            res.send(JSON.stringify(
                [HIVE_HBD], null, 3))
        })
        .catch(function(err) {
            console.log(err)
        })
}

exports.orderbook = (req, res, next) => {
    var depth = parseInt(req.query.depth) || 50
    var dex = fetchHiveOrderBook(depth)
    var orderbook = {
        timestamp: Date.now(),
        bids: [],
        asks: []
    }
    var pair = req.params.ticker_id || req.query.ticker_id
    res.setHeader('Content-Type', 'application/json');
    switch (pair) {
        case `HIVE_HBD`:
            orderbook.ticker_id = `HIVE_HBD`
            makeBook(orderbook, depth, [dex])
                .then(r=>res.send(r))
                .catch(e=>console.log(e)) 
            break;
        default:
            res.send(JSON.stringify({
                ERROR: `ticker_id must be HIVE_HBD`
            }, null, 3))
            break;
    }
}

exports.historical_trades = (req, res, next) => {
    var limit = parseInt(req.query.limit) || 500
    if(limit>999)limit = 1000
    var dex = fetchHiveTradeHistory(limit)
    var orderbook = {
        timestamp: Date.now(),
        buys: [],
        sells: []
    }
    /*
{        
      trade_id:1234567,
      price:"50.1",
      base_volume:"0.1",
      target_volume:"1",
      trade_timestamp:"1700050000",
      type:"buy"
   }

    */
    var pair = req.params.ticker_id || req.query.ticker_id
    var type = req.query.type
    switch (type) {
        case 'buy':
            type = ['buy']
            break;
        case 'ask':
            type = ['sell']
            break;
        default:
            type = ['buy','sell']
            break;
    }
    res.setHeader('Content-Type', 'application/json');
    switch (pair) {
        case `HIVE_HBD`:
            getHistory([dex], 'HIVE_HBD', type, limit)
                .then(r=>res.send(r))
                .catch(e=>console.log(e))  
            break;
        default:
            res.send(JSON.stringify({
                error: 'Ticker_ID is not supported'
            }, null, 3))
            break;
    }
}

// fetch hive details

exports.detail = (req, res, next) => {
    var hiveStats = fetchHiveDynamicProperties()
    res.setHeader('Content-Type', 'application/json');
    Promise.all([hiveStats])
        .then(function(v) {
            const HIVE ={
                name: 'HIVE',
                symbol: 'HIVE',
                icon: 'https://www.dlux.io/img/hextacular.svg',
                supply: RAM.hiveDyn.virtual_supply,
                incirc: RAM.hiveDyn.current_supply,
                wp:`https://hive.io/whitepaper.pdf`,
                ws:`https://hive.io`,
                be:`https://hiveblockexplorer.com/`,
                text: `HIVE is a DPoS blockchain with free transactions and a method to post and rate content.`
            }, 
                HBD = {
                name: 'Hive Backed Dollars',
                symbol: 'HBD',
                icon: 'https://www.dlux.io/img/hbd_green.svg',
                supply: 'Dynamic, up to 10% of HIVE Cap',
                incirc: RAM.hiveDyn.current_hbd_supply,
                wp:`https://hive.io/whitepaper.pdf`,
                ws:`https://hive.io`,
                be:`https://hiveblockexplorer.com/`,
                text: `Hive-backed dollars (HBD) are a unique type of trustless stablecoin that is backed by the underlying value of the Hive blockchain itself instead of external collateral or a centralized entity. HBD are pegged to value of USD. Staking HBD pays a variable APR, currently ${parseFloat(RAM.hiveDyn.hbd_interest_rate / 100).toFixed(2)}%.`
            }

            res.send(JSON.stringify({
                coins: [HIVE,HBD]
            }, null, 3))
        })
        .catch(function(err) {
            console.log(err)
        })
}

//heroku force https

exports.https_redirect = (req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
        if (req.headers['x-forwarded-proto'] != 'https') {
            return res.redirect('https://' + req.headers.host + req.url);
        } else {
            return next();
        }
    } else {
        return next();
    }
};

function fetchHiveDynamicProperties(){
    return new Promise((resolve, reject)=>{
        if (RAM.lastUpdate < Date.now() - config.CACHEMILSEC){
            fetch(config.clientURL, {
                body: `{"jsonrpc":"2.0", "method":"database_api.get_dynamic_global_properties", "id":1}`,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                method: "POST"
                })
                .then(r => r.json())
                .then(res => {
                    RAM.lastUpdate = Date.now()
                    RAM.hiveDyn = res.result
                    resolve('OK')
                })
                .catch(e=>reject(e))
        } else {
            resolve('OK')        
        }
    })
}

function fetchHiveTradeHistory(lim){
    return new Promise((resolve, reject)=>{
        if (RAM.lastUpdate < Date.now() - config.CACHEMILSEC){
            fetch(config.clientURL, {
                body: `{"jsonrpc":"2.0", "method":"market_history_api.get_recent_trades", "params":{"limit":${parseInt(lim)}}, "id":1}`,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                method: "POST"
                })
                .then(r => r.json())
                .then(res => {
                    //add trades to RAM.History based on timestamps/amounts to minimize requests
                    RAM.lastHist = Date.now()
                    RAM.limHist = parseInt(lim)
                    RAM.History = res.result.trades
                    resolve('OK')
                })
                .catch(e=>reject(e))
        } else {
            resolve('OK')        
        }
    })
}

function fetchHiveDexDayBucket(){
    return new Promise((resolve, reject)=>{
        const gun = Date.now()
        const now = new Date(gun)
        const then = new Date(now - 86400000)
        if (RAM.lastUpdateMarket < now - config.CACHEMILSEC){
            fetch(config.clientURL, {
                body: `{"jsonrpc":"2.0", "method":"market_history_api.get_market_history", "params":{"bucket_seconds":3600,"start":"${then.toISOString().substr(0,19)}","end":"${now.toISOString().substr(0,19)}"}, "id":1}`,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                method: "POST"
                })
                .then(r => r.json())
                .then(res => {
                    var highest = 0,
                        lowest = 999999999999999
                    for(i=0; i < res.result.buckets.length; i++){
                        high = parseFloat(res.result.buckets[i].non_hive.high / res.result.buckets[i].hive.high)
                        low = parseFloat(res.result.buckets[i].non_hive.high / res.result.buckets[i].hive.high)
                        if(high > highest)highest = high
                        if(low < lowest)lowest = low
                    }
                    RAM.lastDayBucket = Date.now()
                    RAM.DayBucket = res.result.buckets
                    RAM.High = highest
                    RAM.Low = lowest
                    resolve('OK')
                })
                .catch(e=>reject(e))
        } else {
            resolve('OK')        
        }
    })
}

function fetchHiveDexCurrentPrice(){
    return new Promise((resolve, reject)=>{
        if (RAM.lastUpdateMarket < Date.now() - config.CACHEMILSEC){
            fetch(config.clientURL, {
                body: `{"jsonrpc":"2.0", "method":"market_history_api.get_ticker", "id":1}`,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                method: "POST"
                })
                .then(r => r.json())
                .then(res => {
                    RAM.lastQuote = Date.now()
                    RAM.Ticker = res.result
                    resolve('OK')
                })
                .catch(e=>reject(e))
        } else {
            resolve('OK')        
        }
    })
}

function fetchHiveOrderBook(lim){
    var limit = parseInt(lim) || 100

    return new Promise((resolve, reject)=>{
        if (RAM.lastBook < Date.now() - config.CACHEMILSEC){
            fetch(config.clientURL, {
                body: `{"jsonrpc":"2.0", "method":"market_history_api.get_order_book", "params":{"limit":${limit}}, "id":1}`,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                method: "POST"
                })
                .then(r => r.json())
                .then(res => {
                    RAM.lastBook = Date.now()
                    RAM.Book = res.result
                    resolve('OK')
                })
                .catch(e=>reject(e))
        } else {
            resolve('OK')        
        }
    })
}

function getHistory(promises, pair, typ, lim){
    return new Promise((resolve, reject)=>{
        Promise.all(promises)
        .then(function(v) {
            var buy = [],
                sell = []
            for(var i = 0; i < lim; i++){
                var type = 'sell', 
                    price = 0,
                    base_volume,
                    target_volume
                if(RAM.History[i].current_pays.nai == '@@000000013'){type='buy'}
                if(type == 'buy'){
                    price = parseFloat(RAM.History[i].current_pays.amount / RAM.History[i].open_pays.amount)
                    base_volume = parseFloat(RAM.History[i].open_pays.amount / 1000).toFixed(3)
                    target_volume = parseFloat(RAM.History[i].current_pays.amount / 1000).toFixed(3)
                } else {
                    price = parseFloat(RAM.History[i].open_pays.amount / RAM.History[i].current_pays.amount)
                    base_volume = parseFloat(RAM.History[i].current_pays.amount / 1000).toFixed(3)
                    target_volume = parseFloat(RAM.History[i].open_pays.amount / 1000).toFixed(3)
                }
                const record = {        
                    "trade_id":`${type}:${price}:${RAM.History[i].date}`,
                    price,
                    base_volume,
                    target_volume,
                    "trade_timestamp": RAM.History[i].date,
                    type
                }
                if(record.type == 'buy'){
                    buy.push(record)
                } else {
                    sell.push(record)
                }
            }
            if (typ.indexOf('buy') < 0){
                buy = []
            }
            if (typ.indexOf('sell') < 0){
                sell = []
            }
            
            resolve(JSON.stringify({
                sell,
                buy
            }, null, 3))
        })
        .catch(function(err) {
            reject(err)
        })
    })
}

function makeBook(orderbook, dep, promises){
    return new Promise ((resolve, reject)=>{
        var get = dep
        if(!get)get = 50
    Promise.all(promises)
        .then(function(v) {
            var count1 = 0, count2 = 0
            console.log(RAM.Book)
            for (i = 0; i < RAM.Book.asks.length; i++ ){
                orderbook.asks.push([RAM.Book.asks[i].real_price,parseFloat(RAM.Book.asks[i].hbd / 1000).toFixed(3)])
                count1++
                if(count1 == get)break;
            }
            for (i = 0; i < RAM.Book.bids.length; i++ ){
                orderbook.bids.push([RAM.Book.bids[i].real_price,parseFloat(RAM.Book.bids[i].hbd / 1000).toFixed(3)])
                count2++
                if(count2 == get)break;
            }
            resolve(JSON.stringify({
                asks:orderbook.asks,
                bids:orderbook.bids,
                timestamp: orderbook.timestamp,
                ticker_id: orderbook.ticker_id
            }, null, 3))
        })
        .catch(function(err) {
            reject(err)
        })
    })
}

    function init(){
        return new Promise((resolve, reject)=>{
            var a = fetchHiveDynamicProperties(),
            b = fetchHiveDexCurrentPrice(),
            c = fetchHiveDexDayBucket(),
            d =  fetchHiveTradeHistory(1000),
            e = fetchHiveOrderBook(200)
        Promise.all([a, b, c, d, e]).then(r=>resolve('Ready')).catch(e=>console.log(e))
        })
    }

    exports.init = init