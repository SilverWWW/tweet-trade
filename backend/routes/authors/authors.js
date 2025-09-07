const express = require('express');
const { neon } = require('@neondatabase/serverless');
const axios = require('axios');
const router = express.Router();

// Establish a database connection using the URL from environment variables
const sql = neon(process.env.DATABASE_URL);

/**
 * Endpoint to add a new author to the subscribed_authors_bsky table.
 * @route POST /api/authors/add-bsky-author
 * @param {string} username - The author's BlueSky username (handle).
 * @param {string} name - The author's display name.
 * @param {string} author_context - Descriptive context about the author.
 * @returns {object} 201 - JSON object confirming author creation and the new author's ID.
 * @returns {object} 400 - Error message for missing required fields or invalid username.
 * @returns {object} 409 - Error message if the author already exists.
 * @returns {object} 500 - Error message for server-side failures.
 */
router.post('/add-bsky-author', async (req, res) => {
  try {
    const { username, name, author_context } = req.body;

    if (!username || !name || !author_context) {
      return res.status(400).json({
        error: "Missing required fields: username, name, author_context"
      });
    }

    // Clean the username (remove @ if present)
    const cleanUsername = username.replace(/^@/, '');
    
    // Resolve the DID from the username using BlueSky API
    let bsky_did;
    try {
      const response = await axios.get(`https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(cleanUsername)}`);
      bsky_did = response.data.did;
      
      if (!bsky_did) {
        return res.status(400).json({
          error: "Could not resolve DID for the provided username"
        });
      }
    } catch (resolveError) {
      console.error("Error resolving BlueSky handle:", resolveError.response?.data || resolveError.message);
      return res.status(400).json({
        error: "Invalid BlueSky username or unable to resolve DID"
      });
    }
    
    const [existingAuthor] = await sql`
      SELECT id FROM subscribed_authors_bsky WHERE bsky_did = ${bsky_did}
    `;

    if (existingAuthor) {
      return res.status(409).json({ 
        error: "An author with this BlueSky account already exists." 
      });
    }

    const [newAuthor] = await sql`
      INSERT INTO subscribed_authors_bsky (bsky_did, name, author_context)
      VALUES (${bsky_did}, ${name}, ${author_context})
      RETURNING id
    `;

    res.status(201).json({
      success: true,
      message: "Author added successfully.",
      id: newAuthor.id,
      bsky_did: bsky_did,
      username: cleanUsername
    });
  } catch (error) {
    console.error("Error adding new Bsky author:", error);
    res.status(500).json({ error: "Failed to add author." });
  }
});

/**
 * Endpoint to get all authors from the subscribed_authors_bsky table.
 * @route GET /api/bsky/get-bsky-authors
 * @returns {object} 200 - An array of author objects.
 * @returns {object} 500 - Error message for server-side failures.
 */
router.get('/get-bsky-authors', async (req, res) => {
  try {
    // Select all columns for all authors from the table
    const authors = await sql`
      SELECT id, bsky_did, name, author_context, created_at 
      FROM subscribed_authors_bsky
    `;
    
    // Respond with the array of authors
    res.status(200).json(authors);
  } catch (error) {
    // Log the error and return a server error message
    console.error("Error fetching Bsky authors:", error);
    res.status(500).json({ error: "Failed to fetch authors." });
  }
});

module.exports = router;
