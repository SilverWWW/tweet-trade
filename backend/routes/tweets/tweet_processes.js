const express = require('express');
const { neon } = require('@neondatabase/serverless');
const router = express.Router();

const sql = neon(process.env.DATABASE_URL);

/**
 * GET /api/tweets/processes
 * Get all processed tweets with optional market_effect filter
 * 
 * @param {boolean} market_effect - Filter by market effect (optional)
 * @param {number} limit - Maximum number of results (optional, default: 50, max: 100)
 * @param {number} offset - Number of results to skip (optional, default: 0)
 * @param {string} status - Filter by status (optional: 'submitted', 'completed', 'error')
 * 
 * @returns {object} 200 - Tweets retrieved successfully
 * @returns {object} 400 - Invalid parameters
 * @returns {object} 500 - Server error
 */
router.get('/processes', async (req, res) => {
  try {
    const { market_effect, limit = 50, offset = 0, status } = req.query;

    // Validate limit
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        error: 'Invalid limit parameter',
        message: 'Limit must be a number between 1 and 100'
      });
    }

    // Validate offset
    const offsetNum = parseInt(offset);
    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(400).json({
        error: 'Invalid offset parameter',
        message: 'Offset must be a non-negative number'
      });
    }

    // Validate market_effect if provided
    let marketEffectFilter = null;
    if (market_effect !== undefined) {
      if (market_effect === 'true') {
        marketEffectFilter = true;
      } else if (market_effect === 'false') {
        marketEffectFilter = false;
      } else {
        return res.status(400).json({
          error: 'Invalid market_effect parameter',
          message: 'Market effect must be "true" or "false"'
        });
      }
    }

    // Validate status if provided
    const validStatuses = ['pending', 'completed', 'error'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status parameter',
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Build the query using template literals
    let results;
    let total;

    if (marketEffectFilter !== null && status) {
      // Both filters
      results = await sql`
        SELECT 
          tweet_process_id,
          tweet_content,
          submitted_at,
          status,
          error,
          market_effect,
          trades,
          completed_at,
          author_id
        FROM tweet_processes
        WHERE market_effect = ${marketEffectFilter} AND status = ${status}
        ORDER BY submitted_at DESC 
        LIMIT ${limitNum} OFFSET ${offsetNum}
      `;
      
      const countResult = await sql`
        SELECT COUNT(*) as total FROM tweet_processes 
        WHERE market_effect = ${marketEffectFilter} AND status = ${status}
      `;
      total = parseInt(countResult[0].total);
    } else if (marketEffectFilter !== null) {
      // Only market_effect filter
      results = await sql`
        SELECT 
          tweet_process_id,
          tweet_content,
          submitted_at,
          status,
          error,
          market_effect,
          trades,
          completed_at,
          author_id
        FROM tweet_processes
        WHERE market_effect = ${marketEffectFilter}
        ORDER BY submitted_at DESC 
        LIMIT ${limitNum} OFFSET ${offsetNum}
      `;
      
      const countResult = await sql`
        SELECT COUNT(*) as total FROM tweet_processes 
        WHERE market_effect = ${marketEffectFilter}
      `;
      total = parseInt(countResult[0].total);
    } else if (status) {
      // Only status filter
      results = await sql`
        SELECT 
          tweet_process_id,
          tweet_content,
          submitted_at,
          status,
          error,
          market_effect,
          trades,
          completed_at,
          author_id
        FROM tweet_processes
        WHERE status = ${status}
        ORDER BY submitted_at DESC 
        LIMIT ${limitNum} OFFSET ${offsetNum}
      `;
      
      const countResult = await sql`
        SELECT COUNT(*) as total FROM tweet_processes 
        WHERE status = ${status}
      `;
      total = parseInt(countResult[0].total);
    } else {
      // No filters
      results = await sql`
        SELECT 
          tweet_process_id,
          tweet_content,
          submitted_at,
          status,
          error,
          market_effect,
          trades,
          completed_at,
          author_id
        FROM tweet_processes
        ORDER BY submitted_at DESC 
        LIMIT ${limitNum} OFFSET ${offsetNum}
      `;
      
      const countResult = await sql`
        SELECT COUNT(*) as total FROM tweet_processes
      `;
      total = parseInt(countResult[0].total);
    }

    res.json({
      success: true,
      data: results,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total
      },
      filters: {
        market_effect: marketEffectFilter,
        status: status || null
      }
    });

  } catch (error) {
    console.error('Error fetching tweet processes:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch tweet processes'
    });
  }
});

/**
 * GET /api/tweets/processes/author/:author_id
 * Get all processed tweets from a specific author
 * 
 * @param {string} author_id - Author UUID (required)
 * @param {number} limit - Maximum number of results (optional, default: 50, max: 100)
 * @param {number} offset - Number of results to skip (optional, default: 0)
 * @param {string} status - Filter by status (optional: 'pending', 'completed', 'error')
 * 
 * @returns {object} 200 - Author tweets retrieved successfully
 * @returns {object} 400 - Invalid parameters
 * @returns {object} 404 - Author not found
 * @returns {object} 500 - Server error
 */
router.get('/processes/author/:author_id', async (req, res) => {
  try {
    const { author_id } = req.params;
    const { limit = 50, offset = 0, status } = req.query;

    // Validate author_id format (basic UUID validation)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(author_id)) {
      return res.status(400).json({
        error: 'Invalid author_id format',
        message: 'Author ID must be a valid UUID'
      });
    }

    // Validate limit
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        error: 'Invalid limit parameter',
        message: 'Limit must be a number between 1 and 100'
      });
    }

    // Validate offset
    const offsetNum = parseInt(offset);
    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(400).json({
        error: 'Invalid offset parameter',
        message: 'Offset must be a non-negative number'
      });
    }

    // Validate status if provided
    const validStatuses = ['pending', 'completed', 'error'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status parameter',
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Check if author exists
    const authorCheck = await sql`
      SELECT author_id FROM authors WHERE author_id = ${author_id}
    `;

    if (authorCheck.length === 0) {
      return res.status(404).json({
        error: 'Author not found',
        message: `No author found with ID: ${author_id}`
      });
    }

    // Build the query using template literals
    let results;
    let total;

    if (status) {
      // With status filter
      results = await sql`
        SELECT 
          tweet_process_id,
          tweet_content,
          submitted_at,
          status,
          error,
          market_effect,
          trades,
          completed_at,
          author_id
        FROM tweet_processes
        WHERE author_id = ${author_id} AND status = ${status}
        ORDER BY submitted_at DESC 
        LIMIT ${limitNum} OFFSET ${offsetNum}
      `;
      
      const countResult = await sql`
        SELECT COUNT(*) as total FROM tweet_processes 
        WHERE author_id = ${author_id} AND status = ${status}
      `;
      total = parseInt(countResult[0].total);
    } else {
      // No status filter
      results = await sql`
        SELECT 
          tweet_process_id,
          tweet_content,
          submitted_at,
          status,
          error,
          market_effect,
          trades,
          completed_at,
          author_id
        FROM tweet_processes
        WHERE author_id = ${author_id}
        ORDER BY submitted_at DESC 
        LIMIT ${limitNum} OFFSET ${offsetNum}
      `;
      
      const countResult = await sql`
        SELECT COUNT(*) as total FROM tweet_processes 
        WHERE author_id = ${author_id}
      `;
      total = parseInt(countResult[0].total);
    }

    res.json({
      success: true,
      data: results,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total
      },
      filters: {
        author_id,
        status: status || null
      }
    });

  } catch (error) {
    console.error('Error fetching author tweet processes:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch author tweet processes'
    });
  }
});

module.exports = router;
