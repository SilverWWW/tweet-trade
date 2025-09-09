const axios = require('axios');

const dataApiClientV2 = axios.create({
  baseURL: 'https://data.alpaca.markets/v2',
  headers: {
    'APCA-API-KEY-ID': process.env.ALPACA_API_KEY,
    'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY,
  }
});

const dataApiClientV1 = axios.create({
  baseURL: 'https://data.alpaca.markets/v1beta1',
  headers: {
    'APCA-API-KEY-ID': process.env.ALPACA_API_KEY,
    'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY,
  }
});

const paperApiClient = axios.create({
  baseURL: 'https://paper-api.alpaca.markets/v2',
  headers: {
    'APCA-API-KEY-ID': process.env.ALPACA_API_KEY,
    'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY,
  }
});

/**
 * Helper function to check if current time is within US stock market hours
 * Market hours: Monday-Friday, 9:30 AM - 4:00 PM ET
 * @returns {boolean} - True if market is open, false otherwise
 */
function isMarketOpen() {
  const now = new Date();
  const etTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  const dayOfWeek = etTime.getDay();
  if (dayOfWeek < 1 || dayOfWeek > 5) {
    return false;
  }
  const hours = etTime.getHours();
  const minutes = etTime.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  
  // Market hours: 9:30 AM (570 minutes) to 4:00 PM (960 minutes)
  const marketOpenMinutes = 9 * 60 + 30; // 9:30 AM
  const marketCloseMinutes = 16 * 60; // 4:00 PM
  
  return timeInMinutes >= marketOpenMinutes && timeInMinutes < marketCloseMinutes;
}

/**
 * Fetches the current price of the underlying stock.
 * @param {string} symbol - The stock ticker.
 * @returns {Promise<number>} - The latest ask price for the stock.
 */
async function getCurrentStockPrice(symbol) {
  try {
    const response = await dataApiClientV2.get(`/stocks/trades/latest?symbols=${symbol.toUpperCase()}`);
    const price = response.data.trades[symbol.toUpperCase()]?.p;
    if (!price) throw new Error(`No quote found for ${symbol}`);
    return price;
  } catch (error) {
    console.error(`Error fetching stock price for ${symbol}:`, error.message);
    throw new Error('Unable to fetch current stock price.');
  }
}

/**
 * Fetches available options contracts within a given date range.
 * This function now uses the /options/contracts endpoint for clean, structured data.
 * @param {string} symbol - The underlying stock ticker.
 * @param {string} expirationDateGte - The start date for the search (YYYY-MM-DD).
 * @param {string} expirationDateLte - The end date for the search (YYYY-MM-DD).
 * @param {string} type - 'call' or 'put'.
 * @returns {Promise<Array>} - A list of available contracts.
 */
async function findContracts(symbol, expirationDateGte, expirationDateLte, type) {
  try {
    let contracts = [];
    let pageToken = null;

    do {
      const params = {
        underlying_symbols: symbol,
        limit: 100,
        expiration_date_gte: expirationDateGte,
        expiration_date_lte: expirationDateLte,
        type: type,
      };
      if (pageToken) {
        params.page_token = pageToken;
      }
      
      const response = await paperApiClient.get(`/options/contracts`, { params });
      
      if (response.data.option_contracts) {
          contracts = contracts.concat(response.data.option_contracts);
      }
      pageToken = response.data.next_page_token;

    } while (pageToken);

    return contracts;
  } catch (error) {
    console.error(`Error fetching options contracts for ${symbol}:`, error.message);
    throw new Error(`Unable to fetch options contracts for ${symbol}.`);
  }
}

/**
 * Gets the latest price for a single, specific options contract.
 * @param {string} optionSymbol - The full symbol of the options contract.
 * @returns {Promise<number>} - The latest ask price for the contract.
 */
async function getOptionContractPrice(optionSymbol) {
  try {

    const params = {
      symbols: optionSymbol
    };

    const response = await dataApiClientV1.get(`/options/snapshots`, { params });

    // try ask price, then defer to latest trade price
    const price = response.data.snapshots[optionSymbol].latestQuote.ap ?? response.data.snapshots[optionSymbol].latestTrade.p;
    
    return price; 
  } catch (error) {
    console.error(`Error fetching price for contract ${optionSymbol}:`, error.message);
    throw new Error('Unable to fetch contract price.');
  }
}

module.exports = {
  isMarketOpen,
  getCurrentStockPrice,
  findContracts,
  getOptionContractPrice,
};