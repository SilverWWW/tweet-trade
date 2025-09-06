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
 * POST /api/trading/execute/buy
 * Create a buy order for a given stock
 * 
 * @param {string} ticker - Stock symbol/ticker (required)
 * @param {number} amount - Dollar amount to invest (required)
 * @param {boolean} extended_hours - Allow execution outside regular hours (optional, default: false)
 * 
 * @returns {object} 200 - Order created successfully
 * @returns {object} 400 - Invalid parameters
 * @returns {object} 500 - Server error
 */
router.post('/buy', async (req, res) => {
  try {
    const { ticker, amount, extended_hours = false } = req.body;

    if (!ticker || !amount) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'Both ticker and amount are required'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        error: 'Invalid amount',
        message: 'Amount must be greater than 0'
      });
    }

    if (typeof ticker !== 'string' || ticker.length === 0) {
      return res.status(400).json({
        error: 'Invalid ticker',
        message: 'Ticker must be a non-empty string'
      });
    }

    if (!ALPACA_API_KEY || !ALPACA_SECRET_KEY) {
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Alpaca API credentials not configured'
      });
    }

    const orderType = extended_hours ? 'limit' : 'market';
    const timeInForce = 'day';

    let limitPrice = null;
    if (extended_hours) {
      try {
        const dataApiClient = axios.create({
          baseURL: 'https://data.alpaca.markets/v2',
          headers: {
            'APCA-API-KEY-ID': ALPACA_API_KEY,
            'APCA-API-SECRET-KEY': ALPACA_SECRET_KEY,
            'Content-Type': 'application/json'
          }
        });
        
        const marketResponse = await dataApiClient.get(`/stocks/quotes/latest?symbols=${ticker.toUpperCase()}`);
        const quote = marketResponse.data.quotes[ticker.toUpperCase()];
        
        if (quote && quote.ap > 0) {
          const currentPrice = parseFloat(quote.ap);
          const calculatedPrice = currentPrice * 1.02;
          limitPrice = Math.round(calculatedPrice * 100) / 100;
          console.log(`Setting limit price for ${ticker}: $${currentPrice} -> $${limitPrice.toFixed(2)}`);
        } else {
          throw new Error('No valid ask price available');
        }
      } catch (marketError) {
        console.warn(`Could not fetch market data for ${ticker}, using fallback pricing:`, marketError.message);
        limitPrice = amount * 0.01;
      }
    }

    const orderPayload = {
      symbol: ticker.toUpperCase(),
      notional: amount.toString(),
      side: 'buy',
      type: orderType,
      time_in_force: timeInForce
    };

    if (extended_hours && limitPrice) {
      orderPayload.limit_price = limitPrice.toString();
    }

    if (extended_hours) {
      orderPayload.extended_hours = true;
    }

    const response = await alpacaClient.post('/orders', orderPayload);

    res.status(200).json({
      success: true,
      message: `Buy order created for ${ticker}`,
      order: response.data,
      requested: {
        ticker: ticker.toUpperCase(),
        amount: amount,
        extended_hours: extended_hours,
        order_type: orderType,
        time_in_force: timeInForce,
        limit_price: limitPrice
      }
    });

  } catch (error) {
    console.error('Error creating buy order:', error);

    if (error.response) {
      const statusCode = error.response.status;
      const errorData = error.response.data;

      return res.status(statusCode).json({
        error: 'Alpaca API error',
        message: errorData.message || 'Failed to create order',
        details: errorData
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create buy order'
    });
  }
});

module.exports = router;
