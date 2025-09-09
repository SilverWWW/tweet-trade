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
 * GET /api/trading/account/orders
 * Get all orders for the account
 * 
 * @param {string} status - Order status to query (open, closed, all) (optional, default: 'open')
 * @param {number} limit - Maximum number of orders to return (optional, default: 50, max: 500)
 * @param {string} symbols - Comma-separated list of symbols to filter by (optional)
 * @param {string} side - Filter by order side (buy, sell) (optional)
 * 
 * @returns {object} 200 - Orders retrieved successfully
 * @returns {object} 400 - Invalid parameters
 * @returns {object} 500 - Server error
 */
router.get('/orders', async (req, res) => {
  try {
    const { status = 'open', limit = 50, symbols, side } = req.query;

    if (!ALPACA_API_KEY || !ALPACA_SECRET_KEY) {
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Alpaca API credentials not configured'
      });
    }

    const validStatuses = ['open', 'closed', 'all'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status parameter',
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 500) {
      return res.status(400).json({
        error: 'Invalid limit parameter',
        message: 'Limit must be a number between 1 and 500'
      });
    }

    const queryParams = new URLSearchParams({
      status,
      limit: limitNum.toString()
    });

    if (symbols) {
      queryParams.append('symbols', symbols);
    }

    if (side) {
      const validSides = ['buy', 'sell'];
      if (!validSides.includes(side)) {
        return res.status(400).json({
          error: 'Invalid side parameter',
          message: `Side must be one of: ${validSides.join(', ')}`
        });
      }
      queryParams.append('side', side);
    }

    const response = await alpacaClient.get(`/orders?${queryParams.toString()}`);

    const orders = response.data.map(order => {
      let amount = null;
      
      if (order.notional) {
        amount = parseFloat(order.notional);
      } else if (order.qty && order.filled_avg_price) {
        amount = parseFloat(order.filled_qty) * parseFloat(order.filled_avg_price);
      } else if (order.qty && order.limit_price) {
        amount = parseFloat(order.qty) * parseFloat(order.limit_price);
      }

      return {
        ticker: order.symbol,
        amount: amount,
        order_id: order.id,
        side: order.side,
        type: order.type,
        status: order.status,
        created_at: order.created_at,
        submitted_at: order.submitted_at
      };
    });

    res.status(200).json({
      success: true,
      count: orders.length,
      status: status,
      orders: orders
    });

  } catch (error) {
    console.error('Error fetching orders:', error);

    if (error.response) {
      const statusCode = error.response.status;
      const errorData = error.response.data;

      return res.status(statusCode).json({
        error: 'Alpaca API error',
        message: errorData.message || 'Failed to fetch orders',
        details: errorData
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch orders'
    });
  }
});

/**
 * GET /api/trading/account/positions
 * Get all open positions for the account
 * 
 * @returns {object} 200 - Positions retrieved successfully
 * @returns {object} 500 - Server error
 */
router.get('/positions', async (req, res) => {
  try {
    if (!ALPACA_API_KEY || !ALPACA_SECRET_KEY) {
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Alpaca API credentials not configured'
      });
    }

    const response = await alpacaClient.get('/positions');

    const positions = response.data.map(position => ({
      asset_id: position.asset_id,
      symbol: position.symbol,
      exchange: position.exchange,
      asset_class: position.asset_class,
      avg_entry_price: parseFloat(position.avg_entry_price),
      qty: parseFloat(position.qty),
      qty_available: parseFloat(position.qty_available),
      side: position.side,
      market_value: parseFloat(position.market_value),
      cost_basis: parseFloat(position.cost_basis),
      unrealized_pl: parseFloat(position.unrealized_pl),
      unrealized_plpc: parseFloat(position.unrealized_plpc),
      unrealized_intraday_pl: parseFloat(position.unrealized_intraday_pl),
      unrealized_intraday_plpc: parseFloat(position.unrealized_intraday_plpc),
      current_price: parseFloat(position.current_price),
      lastday_price: parseFloat(position.lastday_price),
      change_today: parseFloat(position.change_today),
      asset_marginable: position.asset_marginable
    }));

    const totalMarketValue = positions.reduce((sum, pos) => sum + pos.market_value, 0);
    const totalCostBasis = positions.reduce((sum, pos) => sum + pos.cost_basis, 0);
    const totalUnrealizedPL = positions.reduce((sum, pos) => sum + pos.unrealized_pl, 0);
    const totalUnrealizedPLPC = totalCostBasis > 0 ? (totalUnrealizedPL / totalCostBasis) * 100 : 0;

    res.status(200).json({
      success: true,
      count: positions.length,
      portfolio_summary: {
        total_market_value: totalMarketValue,
        total_cost_basis: totalCostBasis,
        total_unrealized_pl: totalUnrealizedPL,
        total_unrealized_plpc: totalUnrealizedPLPC
      },
      positions: positions
    });

  } catch (error) {
    console.error('Error fetching positions:', error);

    if (error.response) {
      const statusCode = error.response.status;
      const errorData = error.response.data;

      return res.status(statusCode).json({
        error: 'Alpaca API error',
        message: errorData.message || 'Failed to fetch positions',
        details: errorData
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch positions'
    });
  }
});

module.exports = router;
