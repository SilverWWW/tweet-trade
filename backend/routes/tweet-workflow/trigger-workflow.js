const express = require('express');
const { neon } = require('@neondatabase/serverless');
const router = express.Router();

const sql = neon(process.env.DATABASE_URL);

/**
 * POST /api/process-tweet/trigger-workflow
 * Trigger the tweet processing workflow
 * 
 * @param {string} tweet_author_id - UUID of the author (required)
 * @param {string} tweet_content - Content of the tweet to process (required)
 * 
 * @returns {object} 200 - Workflow triggered successfully
 * @returns {object} 400 - Invalid parameters
 * @returns {object} 404 - Author not found
 * @returns {object} 500 - Server error
 */
router.post('/trigger-workflow', async (req, res) => {
  try {
    const { tweet_author_id, tweet_content } = req.body;

    if (!tweet_author_id || !tweet_content) {
      return res.status(400).json({
        error: "Missing required fields: tweet_author_id, tweet_content"
      });
    }

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(tweet_author_id)) {
      return res.status(400).json({
        error: "Invalid format for tweet_author_id. Must be a valid UUID."
      });
    }

    const [referencedAuthor] = await sql`
    SELECT id, name, author_context FROM subscribed_authors_bsky
    WHERE id = ${tweet_author_id}
    `;

    if (!referencedAuthor) {
      return res.status(404).json({ 
        error: "No author found for this tweet_author_id" 
      });
    }

    const { id, name, author_context } = referencedAuthor;

    if (!process.env.DIFY_API_KEY) {
      console.error("DIFY_API_KEY is not configured");
      return res.status(500).json({
        error: "DIFY_API_KEY environment variable is not configured. Please add it to your .env file.",
        setup_instructions: "Add DIFY_API_KEY=your_dify_api_key to your .env file",
      });
    }

    const tweet_process_id = tweet_author_id + "-" + Date.now() + "-" + Math.random().toString(36).substring(2, 8);

    await sql`
      INSERT INTO tweet_processes (
        tweet_process_id, author_id, tweet_content, submitted_at, status
      ) VALUES (
        ${tweet_process_id}, ${tweet_author_id}, ${tweet_content}, NOW(), 'submitted'
      )
    `;

    const authHeader = `Bearer ${process.env.DIFY_API_KEY}`;
    const baseUrl = process.env.DEPLOYMENT_URL;
    const completionUrl = baseUrl.startsWith("localhost")
      ? `http://${baseUrl}/api/process-tweet/workflow-complete`
      : `https://${baseUrl}/api/process-tweet/workflow-complete`;

    const requestBody = {
      inputs: {
        author: name,
        tweet_content,
        author_context: author_context,
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

module.exports = router;
