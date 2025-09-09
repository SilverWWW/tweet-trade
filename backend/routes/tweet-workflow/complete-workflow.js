const express = require('express');
const { neon } = require('@neondatabase/serverless');
const router = express.Router();

const sql = neon(process.env.DATABASE_URL);

const { isMarketOpen } = require('../trading/market');

/**
 * Helper function to calculate target expiry date based on position
 * @param {string} position - 'long' or 'short'
 * @returns {string} - Target expiry date in YYYY-MM-DD format
 */
function calculateTargetExpiryDate(position) {
  const targetDate = new Date();
  
  if (position === 'short') {
    targetDate.setDate(targetDate.getMonth() + 1);
  } else if (position === 'long') {
    targetDate.setMonth(targetDate.getMonth() + 6);
  } else {
    throw new Error('Invalid position. Must be "long" or "short"');
  }
  
  return targetDate.toISOString().split('T')[0];
}

/**
 * Helper function to process trades and insert into trades_queued table
 * @param {string} tweet_process_id - The tweet process ID
 * @param {array} trades - Array of trade objects
 */
async function processTrades(tweet_process_id, trades) {
  try {
    for (const trade of trades) {
      const { action, position, reasoning, confidence, stock_ticker } = trade;
      
      if (!action || !position || !reasoning || !stock_ticker) {
        console.error('Invalid trade object:', trade);
        continue;
      }
      
      if (action !== 'buy' && action !== 'sell') {
        console.error('Invalid action:', action);
        continue;
      }
      
      if (position !== 'long' && position !== 'short') {
        console.error('Invalid position:', position);
        continue;
      }
      
      const targetExpiryDate = calculateTargetExpiryDate(position);
      const contract = action === 'buy' ? 'call' : 'put';
      const amount = 1000;
      
      try {
        await sql`
          INSERT INTO trades_queued (
            tweet_process_id, ticker, contract, amount, target_expiry_date, reasoning
          ) VALUES (
            ${tweet_process_id}, ${stock_ticker}, ${contract}, ${amount}, ${targetExpiryDate}, ${reasoning}
          )
        `;
        
        console.log(`Successfully queued trade for ${stock_ticker} (${contract})`);
      } catch (dbError) {
        console.error(`Error inserting trade for ${stock_ticker}:`, dbError);
      }
    }
  } catch (error) {
    console.error('Error processing trades:', error);
  }
}

/**
 * POST /api/process-tweet/workflow-complete
 * Handle workflow completion webhook from Dify
 * 
 * @param {object} webhookBody - Webhook payload from Dify
 * @param {string} webhookBody.text - Processed text content
 * @param {string} webhookBody.source - Source of the webhook
 * @param {string} webhookBody.timestamp - Timestamp of the webhook
 * 
 * @returns {object} 200 - Workflow completion recorded successfully
 * @returns {object} 400 - Invalid webhook data
 * @returns {object} 404 - Process not found
 * @returns {object} 500 - Server error
 */
router.post('/workflow-complete', async (req, res) => {
  try {
    const webhookBody = req.body;

    if (!webhookBody.text || !webhookBody.source || !webhookBody.timestamp) {
      return res.status(400).json({ 
        error: "Missing required webhook fields: text, source, timestamp" 
      });
    }

    let body;
    try {
      const cleanedText = webhookBody.text.replace(/\\n/g, "").replace(/\\"/g, '"');
      body = JSON.parse(cleanedText);

      if (body.trades && typeof body.trades === "string") {
        body.trades = JSON.parse(body.trades);
      }
    } catch (parseError) {
      console.error("JSON parsing error:", parseError);
      return res.status(400).json({ error: "Invalid JSON in text field" });
    }

    const { tweet_process_id, status, error_type, error_message, market_effect, trades } = body;

    if (!tweet_process_id || !status) {
      return res.status(400).json({ 
        error: "Missing required fields: tweet_process_id, status" 
      });
    }
    const submittedProcess = await sql`
      SELECT tweet_process_id FROM tweet_processes
      WHERE tweet_process_id = ${tweet_process_id}
    `;

    if (submittedProcess.length === 0) {
      return res.status(404).json({ 
        error: "No submitted process found for this tweet_process_id" 
      });
    }

    if (status !== "ok") {
      await sql`
      UPDATE tweet_processes
      SET
        status = 'error',
        error = '${error_type || "missing type"}: ${error_message || "missing message"}',
        completed_at = NOW()
      WHERE tweet_process_id = ${tweet_process_id}
      `;
      return res.status(400).json({ 
        error: "Error: " + error_type || "missing type" + ": " + error_message || "missing message"
      });
    }

    if (!market_effect) {
      await sql`
      UPDATE tweet_processes
      SET
        status = 'error',
        error = 'Status ok but missing market effect',
        completed_at = NOW()
      WHERE tweet_process_id = ${tweet_process_id}
      `;
      return res.status(400).json({ 
        error: "OK status requires market_effect field" 
      });
    }

    if (market_effect === "yes" && (!trades || trades.length === 0)) {
      await sql`
      UPDATE tweet_processes
      SET
        status = 'error',
        error = 'Market effect yes but missing trades',
        completed_at = NOW()
      WHERE tweet_process_id = ${tweet_process_id}
      `;
      return res.status(400).json({ 
        error: 'Market effect "yes" requires trades array' 
      });
    }

    await sql`
      UPDATE tweet_processes
      SET
        status = 'completed',
        market_effect = ${market_effect === "yes"},
        trades = ${trades ? JSON.stringify(trades) : null},
        completed_at = NOW()
      WHERE tweet_process_id = ${tweet_process_id}
    `;

    if (market_effect === "yes" && trades && trades.length > 0) {
      await processTrades(tweet_process_id, trades);
    }

    res.json({
      success: true,
      tweet_process_id,
      message: "Workflow completion recorded successfully",
    });
  } catch (error) {
    console.error("Error recording workflow completion:", error);
    res.status(500).json({ error: "Failed to record workflow completion" });
  }
});

module.exports = router;
