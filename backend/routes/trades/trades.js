const express = require('express');
const { neon } = require('@neondatabase/serverless');
const router = express.Router();

const sql = neon(process.env.DATABASE_URL);

/**
 * GET /api/trades
 * Get all trades
 * 
 * @returns {object} 200 - All trades retrieved successfully
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
        executed_at,
        days_to_hold
      FROM trades
      ORDER BY queued_at DESC
    `;

    res.status(200).json({
      success: true,
      count: trades.length,
      trades: trades
    });

  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch trades'
    });
  }
});

/**
 * GET /api/trades/count
 * Get the total count of trades
 * 
 * @param {boolean} executed - Filter by execution status (optional)
 * @param {string} ticker - Filter by ticker symbol (optional)
 * 
 * @returns {object} 200 - Trades count retrieved successfully
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
        SELECT COUNT(*) as total FROM trades 
        WHERE executed = ${executedFilter} AND ticker = ${ticker}
      `;
    } else if (executedFilter !== null) {
      // Only executed filter
      countResult = await sql`
        SELECT COUNT(*) as total FROM trades 
        WHERE executed = ${executedFilter}
      `;
    } else if (ticker) {
      // Only ticker filter
      countResult = await sql`
        SELECT COUNT(*) as total FROM trades 
        WHERE ticker = ${ticker}
      `;
    } else {
      // No filters - get total count
      countResult = await sql`
        SELECT COUNT(*) as total FROM trades
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
    console.error('Error fetching trades count:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch trades count'
    });
  }
});

/**
 * GET /api/trades/volume
 * Get the total dollar volume of all executed trades
 * 
 * @param {boolean} executed - Filter by execution status (optional, defaults to true for executed trades)
 * @param {string} ticker - Filter by ticker symbol (optional)
 * 
 * @returns {object} 200 - Volume data retrieved successfully
 * @returns {object} 400 - Invalid parameters
 * @returns {object} 500 - Server error
 */
router.get('/volume', async (req, res) => {
  try {
    const { executed, ticker } = req.query;

    // Default to executed trades only if not specified
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

    // Build the volume query based on filters
    let volumeResult;

    

    if (executedFilter !== null && ticker) {
      // Filter by both execution status and ticker
      volumeResult = await sql`
        SELECT 
          COALESCE(SUM(dollar_amount), 0) as total_volume,
          COUNT(*) as trade_count
        FROM trades 
        WHERE executed = ${executedFilter} AND ticker = ${ticker}
      `;
    } else if (executedFilter !== null) {
      volumeResult = await sql`
        SELECT 
          COALESCE(SUM(dollar_amount), 0) as total_volume,
          COUNT(*) as trade_count
        FROM trades 
        WHERE executed = ${executedFilter}
      `;
    } else if (ticker) {
      volumeResult = await sql`
        SELECT 
          COALESCE(SUM(dollar_amount), 0) as total_volume,
          COUNT(*) as trade_count
        FROM trades 
        WHERE ticker = ${ticker}
      `;
    } else {
      volumeResult = await sql`
        SELECT 
          COALESCE(SUM(dollar_amount), 0) as total_volume,
          COUNT(*) as trade_count
        FROM trades
      `;
    }

    const totalVolume = parseFloat(volumeResult[0].total_volume);
    const tradeCount = parseInt(volumeResult[0].trade_count);

    res.json({
      success: true,
      data: {
        total_volume: totalVolume,
        trade_count: tradeCount,
        average_trade_size: tradeCount > 0 ? totalVolume / tradeCount : 0
      },
      filters: {
        executed: executedFilter,
        ticker: ticker || null
      }
    });

  } catch (error) {
    console.error('Error fetching trades volume:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch trades volume'
    });
  }
});

/**
 * GET /api/trades/:tweet_process_id
 * Get all trades with a specific tweet_process_id
 * 
 * @param {string} tweet_process_id - The tweet process ID to filter by
 * 
 * @returns {object} 200 - Trades retrieved successfully
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
        executed_at,
        days_to_hold
      FROM trades
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
    console.error('Error fetching trades by tweet_process_id:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch trades'
    });
  }
});

module.exports = router;