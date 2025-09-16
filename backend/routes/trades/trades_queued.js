const express = require('express');
const { neon } = require('@neondatabase/serverless');
const router = express.Router();

const sql = neon(process.env.DATABASE_URL);

/**
 * GET /api/trading/trades/queued
 * Get all queued trades
 * 
 * @returns {object} 200 - All queued trades retrieved successfully
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
        queued_at,
        executed,
        days_to_hold
      FROM trades_queued
      ORDER BY queued_at DESC
    `;

    res.status(200).json({
      success: true,
      count: trades.length,
      trades: trades
    });

  } catch (error) {
    console.error('Error fetching queued trades:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch queued trades'
    });
  }
});

/**
 * GET /api/trading/trades/queued/count
 * Get the total count of queued trades
 * 
 * @param {boolean} executed - Filter by execution status (optional)
 * @param {string} ticker - Filter by ticker symbol (optional)
 * 
 * @returns {object} 200 - Queued trades count retrieved successfully
 * @returns {object} 400 - Invalid parameters
 * @returns {object} 500 - Server error
 */
router.get('/count', async (req, res) => {
  try {
    const { executed, ticker } = req.query;

    // Validate executed if provided
    let executedFilter = null;
    if (executed !== undefined) {
      if (executed === 'true') {
        executedFilter = true;
      } else if (executed === 'false') {
        executedFilter = false;
      } else {
        return res.status(400).json({
          error: 'Invalid executed parameter',
          message: 'Executed must be "true" or "false"'
        });
      }
    }

    // Validate ticker if provided
    if (ticker && (typeof ticker !== 'string' || ticker.trim().length === 0)) {
      return res.status(400).json({
        error: 'Invalid ticker parameter',
        message: 'Ticker must be a non-empty string'
      });
    }

    // Build the count query based on filters
    let countResult;

    if (executedFilter !== null && ticker) {
      // Both filters
      countResult = await sql`
        SELECT COUNT(*) as total FROM trades_queued 
        WHERE executed = ${executedFilter} AND ticker = ${ticker}
      `;
    } else if (executedFilter !== null) {
      // Only executed filter
      countResult = await sql`
        SELECT COUNT(*) as total FROM trades_queued 
        WHERE executed = ${executedFilter}
      `;
    } else if (ticker) {
      // Only ticker filter
      countResult = await sql`
        SELECT COUNT(*) as total FROM trades_queued 
        WHERE ticker = ${ticker}
      `;
    } else {
      // No filters - get total count
      countResult = await sql`
        SELECT COUNT(*) as total FROM trades_queued
      `;
    }

    const total = parseInt(countResult[0].total);

    res.json({
      success: true,
      data: {
        total
      },
      filters: {
        executed: executedFilter,
        ticker: ticker || null
      }
    });

  } catch (error) {
    console.error('Error fetching queued trades count:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch queued trades count'
    });
  }
});

/**
 * GET /api/trading/trades/queued/:tweet_process_id
 * Get all queued trades with a specific tweet_process_id
 * 
 * @param {string} tweet_process_id - The tweet process ID to filter by
 * 
 * @returns {object} 200 - Queued trades retrieved successfully
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
        queued_at,
        executed,
        days_to_hold
      FROM trades_queued
      WHERE tweet_process_id = ${tweet_process_id}
      ORDER BY queued_at DESC
    `;

    res.status(200).json({
      success: true,
      count: trades.length,
      tweet_process_id: tweet_process_id,
      trades: trades
    });

  } catch (error) {
    console.error('Error fetching queued trades by tweet_process_id:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch queued trades'
    });
  }
});

module.exports = router;
