const express = require('express');
const { neon } = require('@neondatabase/serverless');
const router = express.Router();

const sql = neon(process.env.DATABASE_URL);

// Trigger workflow endpoint
router.post('/trigger-workflow', async (req, res) => {
  try {
    const { tweet_author, tweet_content, author_context, tweet_process_id } = req.body;

    // Validate required fields
    if (!tweet_author || !tweet_content || !author_context || !tweet_process_id) {
      return res.status(400).json({
        error: "Missing required fields: tweet_author, tweet_content, author_context, tweet_process_id"
      });
    }

    if (!process.env.DIFY_API_KEY) {
      console.error("DIFY_API_KEY is not configured");
      return res.status(500).json({
        error: "DIFY_API_KEY environment variable is not configured. Please add it to your .env file.",
        setup_instructions: "Add DIFY_API_KEY=your_dify_api_key to your .env file",
      });
    }

    await sql`
      INSERT INTO tweet_processes_submitted (
        tweet_process_id, author, tweet_content, author_context, submitted_at
      ) VALUES (
        ${tweet_process_id}, ${tweet_author}, ${tweet_content}, ${author_context}, NOW()
      )
    `;

    const authHeader = `Bearer ${process.env.DIFY_API_KEY}`;

    const baseUrl = process.env.DEPLOYMENT_URL || "localhost:3000";
    const completionUrl = baseUrl.startsWith("localhost")
      ? `http://${baseUrl}/api/process-tweet/workflow-complete`
      : `https://${baseUrl}/api/process-tweet/workflow-complete`;

    const requestBody = {
      inputs: {
        author: tweet_author,
        tweet_content,
        author_context,
        tweet_process_id,
        completion_url: completionUrl,
      },
      response_mode: "streaming",
      user: "wsilver",
    };

    const difyResponse = await fetch("https://api.dify.ai/v1/workflows/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(requestBody),
    });

    if (!difyResponse.ok) {
      const errorText = await difyResponse.text();
      console.error("Dify API error response:", errorText);
      throw new Error(`Dify API error: ${difyResponse.status} - ${errorText}`);
    }

    res.json({
      success: true,
      tweet_process_id,
    });
  } catch (error) {
    console.error("Error triggering workflow:", error);
    res.status(500).json({ error: "Failed to trigger workflow" });
  }
});

// Workflow complete endpoint
router.post('/workflow-complete', async (req, res) => {
  try {
    const webhookBody = req.body;

    // Validate webhook structure
    if (!webhookBody.text || !webhookBody.source || !webhookBody.timestamp) {
      return res.status(400).json({ 
        error: "Missing required webhook fields: text, source, timestamp" 
      });
    }

    let body;
    try {
      const cleanedText = webhookBody.text.replace(/\\n/g, "").replace(/\\"/g, '"');
      body = JSON.parse(cleanedText);

      // Handle trades field if it's still a string after parsing
      if (body.trades && typeof body.trades === "string") {
        body.trades = JSON.parse(body.trades);
      }
    } catch (parseError) {
      console.error("JSON parsing error:", parseError);
      return res.status(400).json({ error: "Invalid JSON in text field" });
    }

    const { tweet_process_id, status, error_type, error_message, market_effect, trades } = body;

    // Validate required fields
    if (!tweet_process_id || !status) {
      return res.status(400).json({ 
        error: "Missing required fields: tweet_process_id, status" 
      });
    }

    // Validate status-specific fields
    if (status === "error" && (!error_type || !error_message)) {
      return res.status(400).json({ 
        error: "Error status requires error_type and error_message" 
      });
    }

    if (status === "ok" && !market_effect) {
      return res.status(400).json({ 
        error: "OK status requires market_effect field" 
      });
    }

    if (market_effect === "yes" && (!trades || trades.length === 0)) {
      return res.status(400).json({ 
        error: 'Market effect "yes" requires trades array' 
      });
    }

    // Check if submitted process exists
    const submittedProcess = await sql`
      SELECT tweet_process_id FROM tweet_processes_submitted 
      WHERE tweet_process_id = ${tweet_process_id}
    `;

    if (submittedProcess.length === 0) {
      return res.status(404).json({ 
        error: "No submitted process found for this tweet_process_id" 
      });
    }

    // Insert completed process
    await sql`
      INSERT INTO tweet_processes_completed (
        tweet_process_id, status, error_type, error_message, 
        market_effect, trades, completed_at
      ) VALUES (
        ${tweet_process_id}, ${status}, ${error_type || null}, ${error_message || null},
        ${market_effect || null}, ${trades ? JSON.stringify(trades) : null}, NOW()
      )
    `;

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
