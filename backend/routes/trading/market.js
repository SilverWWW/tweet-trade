const express = require('express');
const axios = require('axios');
const router = express.Router();

const ALPACA_BASE_URL = 'https://paper-api.alpaca.markets/v2';
const ALPACA_API_KEY = process.env.ALPACA_API_KEY;
const ALPACA_SECRET_KEY = process.env.ALPACA_SECRET_KEY;

const alpacaClient = axios.create({
  baseURL: ALPACA_BASE_URL,
  headers: {
    'APCA-API-KEY-ID': ALPACA_API_KEY,
    'APCA-API-SECRET-KEY': ALPACA_SECRET_KEY,
    'Content-Type': 'application/json'
  }
});

/**
 * Helper function to get current stock price
 * @param {string} symbol - Stock symbol
 * @returns {number} - Current stock price
 */
async function getCurrentStockPrice(symbol) {
  try {
    const dataApiClient = axios.create({
      baseURL: 'https://data.alpaca.markets/v2',
      headers: {
        'APCA-API-KEY-ID': ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': ALPACA_SECRET_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    const marketResponse = await dataApiClient.get(`/stocks/quotes/latest?symbols=${symbol.toUpperCase()}`);
    const quote = marketResponse.data.quotes[symbol.toUpperCase()];
    
    if (quote && quote.ap > 0) {
      return parseFloat(quote.ap);
    } else {
      throw new Error('No valid ask price available');
    }
  } catch (error) {
    console.warn(`Could not fetch market data for ${symbol}:`, error.message);
    throw new Error('Unable to fetch current stock price');
  }
}

/**
 * Helper function to fetch options contracts
 * @param {string} symbol - Stock symbol
 * @param {string} optionType - 'call' or 'put'
 * @returns {array} - Array of options contracts
 */
async function fetchOptionsContracts(symbol, optionType = null) {
  try {
    const params = {
      underlying_symbols: symbol.toUpperCase(),
      limit: 100
    };

    if (optionType && (optionType === 'call' || optionType === 'put')) {
      params.type = optionType;
    }

    const contractsResponse = await alpacaClient.get('/options/contracts', { params });
    return contractsResponse.data.option_contracts || [];
  } catch (error) {
    console.error(`Error fetching options contracts for ${symbol}:`, error);
    throw new Error(`Unable to fetch options contracts for ${symbol}`);
  }
}

module.exports = { router, getCurrentStockPrice, fetchOptionsContracts };
