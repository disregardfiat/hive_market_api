Installation:
`$ git clone https://github.com/disregardfiat/hive_market_api.git`
`$ npm i`
`$ node index`

It's meant to be run from a witness server WITH the market_history plugin. But you can just as easily point to one. I won't go into any details of routing this through a reverse proxy, but I will say the `CACHEMILSEC` is set to 60 secs because that's the query interval for coingecko. You can make a `.env` file to store your config variables.

```exports.PORT = ENV.PORT || 3000;
exports.clientURL = ENV.CLIENTURL || "https://rpc.ecency.com/"  // 'http://127.0.0.1:8091/' //Run from same server.
exports.CACHEMILSEC = ENV.CACHEMILSEC || 60000 //1 minute
```

Here's the short list of API

`/api/orderbook/HIVE_HBD`
`/api/historical_trades/HIVE_HBD`
`/api/pairs`
`/api/tickers`
`/api/coin_detail`