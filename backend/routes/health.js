const express = require('express');
const { neon } = require('@neondatabase/serverless');
const router = express.Router();

const sql = neon(process.env.DATABASE_URL);

/**
 * GET /api/health
 * Health check endpoint
 * 
 * @returns {object} 200 - Service is healthy
 * @returns {object} 500 - Service is unhealthy
 */
router.get('/', async (req, res) => {
  try {
    await sql`SELECT 1`;

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
    });
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: "Database connection failed",
    });
  }
});

module.exports = router;
