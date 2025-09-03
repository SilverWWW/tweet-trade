const express = require('express');
const { neon } = require('@neondatabase/serverless');
const router = express.Router();

// Start subscription service
router.post('/start', async (req, res) => {
  try {
    const sql = neon(process.env.DATABASE_URL);

    await sql`
      INSERT INTO subscription_state (service_name, is_active, updated_at)
      VALUES ('subscription_websocket', true, NOW())
      ON CONFLICT (service_name) 
      DO UPDATE SET is_active = true, updated_at = NOW()
    `;

    res.json({
      success: true,
      message: "Subscription service started successfully",
      status: "success",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error starting subscription service:", error);
    res.status(500).json({
      success: false,
      error: "Failed to start service",
      message: error instanceof Error ? error.message : "Unknown error",
      status: "error",
    });
  }
});

// Get subscription service status
router.get('/status', async (req, res) => {
  try {
    const sql = neon(process.env.DATABASE_URL);

    const result = await sql`
      SELECT * FROM subscription_state 
      WHERE service_name = 'subscription_websocket' 
      LIMIT 1
    `;

    if (result.length === 0) {
      // Create initial record if it doesn't exist
      await sql`
        INSERT INTO subscription_state (service_name, is_active, updated_at)
        VALUES ('subscription_websocket', false, NOW())
      `;

      return res.json({
        isActive: false,
        lastUpdated: new Date().toISOString(),
        message: "Service initialized",
        status: "success",
      });
    }

    const status = result[0];
    res.json({
      isActive: status.is_active,
      lastUpdated: status.last_updated,
      message: status.is_active ? "Service is running" : "Service is stopped",
      status: "success",
    });
  } catch (error) {
    console.error("Error getting subscription service status:", error);
    res.status(500).json({
      error: "Failed to get service status",
      message: error instanceof Error ? error.message : "Unknown error",
      status: "error",
    });
  }
});

// Stop subscription service
router.post('/stop', async (req, res) => {
  try {
    const sql = neon(process.env.DATABASE_URL);

    await sql`
      INSERT INTO subscription_state (service_name, is_active, updated_at)
      VALUES ('subscription_websocket', false, NOW())
      ON CONFLICT (service_name) 
      DO UPDATE SET is_active = false, updated_at = NOW()
    `;

    res.json({
      success: true,
      message: "Subscription service stopped successfully",
      status: "success",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error stopping subscription service:", error);
    res.status(500).json({
      success: false,
      error: "Failed to stop service",
      message: error instanceof Error ? error.message : "Unknown error",
      status: "error",
    });
  }
});

module.exports = router;
