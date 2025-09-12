const express = require('express');
const axios = require('axios');
const router = express.Router();

const { isMarketOpen } = require('../market');

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
 * Helper function to validate stock order parameters
 * @param {string} ticker - Stock ticker symbol
 * @param {number} dollarAmount - Dollar amount to invest
 * @returns {object} - Validation result
 */
function validateStockOrderParams(ticker, dollarAmount) {
  const errors = [];

  if (!ticker || typeof ticker !== 'string' || ticker.length === 0) {
    errors.push('Ticker must be a non-empty string');
  }

  if (!dollarAmount || dollarAmount <= 0) {
    errors.push('Dollar amount must be greater than 0');
  }

  if (!ALPACA_API_KEY || !ALPACA_SECRET_KEY) {
    errors.push('Alpaca API credentials not configured');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * POST /api/trading/execute/stock/buy
 * Create a buy order for stocks
 * 
 * @param {string} ticker - Stock symbol/ticker (required)
 * @param {number} dollarAmount - Dollar amount to invest (required)
 * 
 * @returns {object} 200 - Order created successfully
 * @returns {object} 400 - Invalid parameters or market closed
 * @returns {object} 500 - Server error
 */
router.post('/buy', async (req, res) => {
  // Check if market is currently open
  if (!isMarketOpen()) {
    return res.status(400).json({
      error: 'Market is closed',
      message: 'Trading is only allowed during market hours (Monday-Friday, 9:30 AM - 4:00 PM ET)'
    });
  }

  try {
    const { ticker, dollarAmount } = req.body;

    // Validate parameters
    const validation = validateStockOrderParams(ticker, dollarAmount);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid parameters',
        message: validation.errors.join(', ')
      });
    }

    // Create simple market order using notional (dollar amount)
    const orderPayload = {
      symbol: ticker.toUpperCase(),
      notional: dollarAmount.toString(),
      side: 'buy',
      type: 'market',
      time_in_force: 'day'
    };

    const response = await alpacaClient.post('/orders', orderPayload);

    res.status(200).json({
      success: true,
      message: `Stock buy order created for ${ticker.toUpperCase()}`,
      order: response.data,
      requested: {
        ticker: ticker.toUpperCase(),
        dollarAmount: dollarAmount
      }
    });

  } catch (error) {
    console.error('Error creating stock buy order:', error);

    if (error.response) {
      const statusCode = error.response.status;
      const errorData = error.response.data;

      return res.status(statusCode).json({
        error: 'Alpaca API error',
        message: errorData.message || 'Failed to create stock buy order',
        details: errorData
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Failed to create stock buy order'
    });
  }
});

module.exports = router;
