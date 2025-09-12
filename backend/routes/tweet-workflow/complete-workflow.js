const express = require('express');
const { neon } = require('@neondatabase/serverless');
const axios = require('axios');
const router = express.Router();

const sql = neon(process.env.DATABASE_URL);

const { isMarketOpen } = require('../trading/market');

/**
 * Helper function to execute a stock buy order via API call
 * @param {string} ticker - Stock ticker symbol
 * @param {number} dollarAmount - Dollar amount to invest
 * @returns {Promise<object>} - API response
 */
async function executeBuyOrder(ticker, dollarAmount) {
  try {
    const baseUrl = process.env.DEPLOYMENT_URL;

    const orderUrl = baseUrl.startsWith("localhost")
      ? `http://${baseUrl}/api/trading/execute/stock/buy`
      : `https://${baseUrl}/api/trading/execute/stock/buy`;

    const response = await axios.post(orderUrl, {
      ticker,
      dollarAmount
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error executing buy order for ${ticker}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Helper function to queue a trade in the database
 * @param {string} tweetProcessId - The tweet process ID
 * @param {string} ticker - Stock ticker symbol
 * @param {number} dollar_amount - Dollar amount to invest
 * @param {number} days_to_hold - Number of days to hold the position
 * @param {string} reasoning - Trade reasoning
 * @returns {Promise<void>}
 */
async function queueTrade(tweetProcessId, ticker, dollar_amount, days_to_hold, reasoning) {
  try {
    await sql`
      INSERT INTO trades_queued (
        tweet_process_id, ticker, dollar_amount, days_to_hold, reasoning
      ) VALUES (
        ${tweetProcessId}, ${ticker}, ${dollar_amount}, ${days_to_hold}, ${reasoning}
      )
    `;
    console.log(`Successfully queued trade for ${ticker}`);
  } catch (error) {
    console.error(`Error queuing trade for ${ticker}:`, error);
    throw error;
  }
}

/**
 * Helper function to log an executed trade in the database
 * @param {string} tweetProcessId - The tweet process ID
 * @param {string} ticker - Stock ticker symbol
 * @param {number} dollar_amount - Total money spent (from order confirmation)
 * @param {string} reasoning - Trade reasoning
 * @param {number} days_to_hold - Number of days to hold the position
 * @returns {Promise<void>}
 */
async function logExecutedTrade(tweetProcessId, ticker, dollar_amount, reasoning, days_to_hold) {
  try {
    await sql`
      INSERT INTO trades_executed (
        tweet_process_id, ticker, dollar_amount, reasoning, days_to_hold
      ) VALUES (
        ${tweetProcessId}, ${ticker}, ${dollar_amount}, ${reasoning}, ${days_to_hold}
      )
    `;
    console.log(`Successfully logged executed trade for ${ticker}`);
  } catch (error) {
    console.error(`Error logging executed trade for ${ticker}:`, error);
    throw error;
  }
}

/**
 * Helper function to process trades and insert into trades_queued table
 * @param {string} tweet_process_id - The tweet process ID
 * @param {array} trades - Array of trade objects
 */
async function processTrades(tweet_process_id, trades) {
  try {
    for (const trade of trades) {
      const { timeline, reasoning, confidence, stock_ticker } = trade;
      
      if (!timeline || !reasoning || !stock_ticker || !confidence) {
        console.error('Invalid trade object:', trade);
        continue;
      }

      const dollarAmount = 1000 * confidence;
      const daysToHold = timeline;

      if (isMarketOpen()) {
        try {
          const orderResult = await executeBuyOrder(stock_ticker, dollarAmount);
          console.log(`Successfully executed trade for ${stock_ticker}:`, orderResult);
          
          try {
            const totalAmountSpent = orderResult.requested.dollarAmount;
            
            await logExecutedTrade(
              tweet_process_id,
              stock_ticker,
              totalAmountSpent,
              reasoning,
              daysToHold
            );
          } catch (logError) {
            console.error(`Error logging executed trade for ${stock_ticker}:`, logError);
          }
        } catch (orderError) {
          console.error(`Error executing trade for ${stock_ticker}:`, orderError);
          // If execution fails, fall back to queuing
          try {
            await queueTrade(tweet_process_id, stock_ticker, dollarAmount, daysToHold, reasoning);
            console.log(`Fallback: Successfully queued trade for ${stock_ticker} after execution failed`);
          } catch (queueError) {
            console.error(`Error queuing trade for ${stock_ticker} after execution failed:`, queueError);
          }
        }
      } else {
        try {
          // Market is closed, queue the trade
          await queueTrade(tweet_process_id, stock_ticker, dollarAmount, daysToHold, reasoning);
          console.log(`Market closed: Successfully queued trade for ${stock_ticker}`);
        } catch (queueError) {
          console.error(`Error queuing trade for ${stock_ticker}:`, queueError);
        }
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
