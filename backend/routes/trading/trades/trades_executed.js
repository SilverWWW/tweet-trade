const express = require('express');
const { neon } = require('@neondatabase/serverless');
const router = express.Router();

const sql = neon(process.env.DATABASE_URL);

/**
 * GET /api/trading/trades/executed
 * Get all executed trades
 * 
 * @returns {object} 200 - All executed trades retrieved successfully
 * @returns {object} 500 - Server error
 */
router.get('/', async (req, res) => {
  try {
    const trades = await sql`
      SELECT 
        id,
        tweet_process_id,
        ticker,
        dollar_amount,
        reasoning,
        executed_at,
        days_to_hold
      FROM trades_executed
      ORDER BY executed_at DESC
    `;

    res.status(200).json({
      success: true,
      count: trades.length,
      trades: trades
    });

  } catch (error) {
    console.error('Error fetching executed trades:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch executed trades'
    });
  }
});

/**
 * GET /api/trading/trades/executed/:tweet_process_id
 * Get all executed trades with a specific tweet_process_id
 * 
 * @param {string} tweet_process_id - The tweet process ID to filter by
 * 
 * @returns {object} 200 - Executed trades retrieved successfully
 * @returns {object} 400 - Invalid tweet_process_id parameter
 * @returns {object} 500 - Server error
 */
router.get('/:tweet_process_id', async (req, res) => {
  try {
    const { tweet_process_id } = req.params;

    if (!tweet_process_id || typeof tweet_process_id !== 'string' || tweet_process_id.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid tweet_process_id parameter',
        message: 'tweet_process_id must be a non-empty string'
      });
    }

    const trades = await sql`
      SELECT 
        id,
        tweet_process_id,
        ticker,
        dollar_amount,
        reasoning,
        executed_at,
        days_to_hold
      FROM trades_executed
      WHERE tweet_process_id = ${tweet_process_id}
      ORDER BY executed_at DESC
    `;

    res.status(200).json({
      success: true,
      count: trades.length,
      tweet_process_id: tweet_process_id,
      trades: trades
    });

  } catch (error) {
    console.error('Error fetching executed trades by tweet_process_id:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch executed trades'
    });
  }
});

/**
 * GET /api/trading/trades/executed/count
 * Get the total count of executed trades
 * 
 * @param {string} ticker - Filter by ticker symbol (optional)
 * 
 * @returns {object} 200 - Executed trades count retrieved successfully
 * @returns {object} 400 - Invalid parameters
 * @returns {object} 500 - Server error
 */
router.get('/count', async (req, res) => {
  try {
    const { ticker } = req.query;

    // Validate ticker if provided
    if (ticker && (typeof ticker !== 'string' || ticker.trim().length === 0)) {
      return res.status(400).json({
        error: 'Invalid ticker parameter',
        message: 'Ticker must be a non-empty string'
      });
    }

    // Build the count query based on filters
    let countResult;

    if (ticker) {
      // With ticker filter
      countResult = await sql`
        SELECT COUNT(*) as total FROM trades_executed 
        WHERE ticker = ${ticker}
      `;
    } else {
      // No filters - get total count
      countResult = await sql`
        SELECT COUNT(*) as total FROM trades_executed
      `;
    }

    const total = parseInt(countResult[0].total);

    res.json({
      success: true,
      data: {
        total
      },
      filters: {
        ticker: ticker || null
      }
    });

  } catch (error) {
    console.error('Error fetching executed trades count:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch executed trades count'
    });
  }
});

module.exports = router;
