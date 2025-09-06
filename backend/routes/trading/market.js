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
 * GET /api/trading/market/stock-price/:symbol
 * Get current market data for a given stock symbol
 * 
 * @param {string} symbol - Stock symbol/ticker (required)
 * 
 * @returns {object} 200 - Market data retrieved successfully
 * @returns {object} 400 - Invalid symbol parameter
 * @returns {object} 404 - Asset not found
 * @returns {object} 500 - Server error
 */
router.get('/stock-price/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;

    if (!symbol || typeof symbol !== 'string' || symbol.length === 0) {
      return res.status(400).json({
        error: 'Invalid symbol parameter',
        message: 'Symbol must be a non-empty string'
      });
    }

    if (!ALPACA_API_KEY || !ALPACA_SECRET_KEY) {
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Alpaca API credentials not configured'
      });
    }

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
    let marketData = null;
    
    if (quote) {
      marketData = {
        symbol: symbol.toUpperCase(),
        timestamp: quote.t,
        bid_price: quote.bp,
        bid_size: quote.bs,
        bid_exchange: quote.bx,
        ask_price: quote.ap,
        ask_size: quote.as,
        ask_exchange: quote.ax,
        conditions: quote.c,
        tape: quote.z
      };
    }

    res.status(200).json({
      success: true,
      market_data: marketData
    });

  } catch (error) {
    console.error('Error fetching stock price:', error);

    if (error.response) {
      const statusCode = error.response.status;
      const errorData = error.response.data;

      if (statusCode === 404) {
        return res.status(404).json({
          error: 'Asset not found',
          message: `No asset found for symbol: ${req.params.symbol}`
        });
      }

      return res.status(statusCode).json({
        error: 'Alpaca API error',
        message: errorData.message || 'Failed to fetch asset information',
        details: errorData
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch stock information'
    });
  }
});

module.exports = router;
