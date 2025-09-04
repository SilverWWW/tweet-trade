const express = require('express');
const { neon } = require('@neondatabase/serverless');
const router = express.Router();

// Establish a database connection using the URL from environment variables
const sql = neon(process.env.DATABASE_URL);

/**
 * Endpoint to add a new user to the subscribed_users_bsky table.
 * @route POST /api/bsky
 * @param {string} bsky_did - The user's BlueSky decentralized identifier.
 * @param {string} name - The user's display name.
 * @param {string} user_context - Descriptive context about the user.
 * @returns {object} 201 - JSON object confirming user creation and the new user's ID.
 * @returns {object} 400 - Error message for missing required fields.
 * @returns {object} 409 - Error message if the user already exists.
 * @returns {object} 500 - Error message for server-side failures.
 */
router.post('/bsky', async (req, res) => {
  try {
    const { bsky_did, name, user_context } = req.body;

    // Validate that all required fields are present in the request body
    if (!bsky_did || !name || !user_context) {
      return res.status(400).json({
        error: "Missing required fields: bsky_did, name, user_context"
      });
    }
    
    // Check if a user with the provided bsky_did already exists to prevent duplicates
    const [existingUser] = await sql`
      SELECT id FROM subscribed_users_bsky WHERE bsky_did = ${bsky_did}
    `;

    if (existingUser) {
      return res.status(409).json({ 
        error: "A user with this bsky_did already exists." 
      });
    }

    // Insert the new user into the database and return their newly generated UUID
    const [newUser] = await sql`
      INSERT INTO subscribed_users_bsky (bsky_did, name, user_context)
      VALUES (${bsky_did}, ${name}, ${user_context})
      RETURNING id
    `;

    // Respond with a success message and the ID of the created user
    res.status(201).json({
      success: true,
      message: "User added successfully.",
      userId: newUser.id,
    });
  } catch (error) {
    // Log the error for debugging and return a generic server error message
    console.error("Error adding new Bsky user:", error);
    res.status(500).json({ error: "Failed to add user." });
  }
});

module.exports = router;
