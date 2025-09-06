const express = require('express');
const { neon } = require('@neondatabase/serverless');
const router = express.Router();

// Establish a database connection using the URL from environment variables
const sql = neon(process.env.DATABASE_URL);

/**
 * Endpoint to add a new author to the subscribed_authors_bsky table.
 * @route POST /api/bsky
 * @param {string} bsky_did - The author's BlueSky decentralized identifier.
 * @param {string} name - The author's display name.
 * @param {string} author_context - Descriptive context about the author.
 * @returns {object} 201 - JSON object confirming author creation and the new author's ID.
 * @returns {object} 400 - Error message for missing required fields.
 * @returns {object} 409 - Error message if the author already exists.
 * @returns {object} 500 - Error message for server-side failures.
 */
router.post('/add-bsky-author', async (req, res) => {
  try {
    const { bsky_did, name, author_context } = req.body;

    // Validate that all required fields are present in the request body
    if (!bsky_did || !name || !author_context) {
      return res.status(400).json({
        error: "Missing required fields: bsky_did, name, author_context"
      });
    }
    
    // Check if a author with the provided bsky_did already exists to prevent duplicates
    const [existingAuthor] = await sql`
      SELECT id FROM subscribed_authors_bsky WHERE bsky_did = ${bsky_did}
    `;

    if (existingAuthor) {
      return res.status(409).json({ 
        error: "An author with this bsky_did already exists." 
      });
    }

    // Insert the new author into the database and return their newly generated UUID
    const [newAuthor] = await sql`
      INSERT INTO subscribed_authors_bsky (bsky_did, name, author_context)
      VALUES (${bsky_did}, ${name}, ${author_context})
      RETURNING id
    `;

    // Respond with a success message and the ID of the created author
    res.status(201).json({
      success: true,
      message: "Author added successfully.",
      id: newAuthor.id,
    });
  } catch (error) {
    // Log the error for debugging and return a generic server error message
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
