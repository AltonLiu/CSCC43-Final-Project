const express = require('express');
const pool = require('../db');
const router = express.Router();

// --- Create a New Stock List ---
router.post('/new', async (req, res) => {
    const { name } = req.body;
    const userId = req.user.email;

    try {
        const result = await pool.query(
            `INSERT INTO stocklists (uid, name) VALUES ($1, $2) RETURNING *`,
            [userId, name]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create stock list' });
    }
});

// --- Add a Stock to a Stock List ---
router.post('/:lid/add', async (req, res) => {
    const { lid } = req.params;
    const { stock, shares } = req.body;
    const userId = req.user.email;

    try {
        // Ensure the stock list belongs to the user
        const stockListResult = await pool.query(
            `SELECT * FROM stocklists WHERE lid = $1 AND uid = $2`,
            [lid, userId]
        );

        if (stockListResult.rows.length === 0) {
            return res.status(404).json({ error: 'Stock list not found or unauthorized' });
        }

        // Add the stock to the stock list
        await pool.query(
            `INSERT INTO stocklistitems (lid, stock, shares)
         VALUES ($1, $2, $3)
         ON CONFLICT (lid, stock) DO UPDATE
         SET shares = stocklistitems.shares + EXCLUDED.shares`,
            [lid, stock, shares]
        );

        res.json({ message: 'Stock added successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add stock to stock list' });
    }
});

// --- Get All Stock Lists for a User ---
router.get('/', async (req, res) => {
    const userId = req.user.email;

    try {
        const privateLists = await pool.query(
            `SELECT * FROM stocklists WHERE uid = $1 AND visibility = 'private'`,
            [userId]
        );

        const sharedLists = await pool.query(
            `SELECT * FROM stocklists WHERE uid = $1 AND visibility = 'shared'`,
            [userId]
        );

        const publicLists = await pool.query(
            `SELECT * FROM stocklists WHERE visibility = 'public'`
        );

        res.json({
            privateLists: privateLists.rows,
            sharedLists: sharedLists.rows,
            publicLists: publicLists.rows,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch stock lists' });
    }
});

// --- Get Details for a Specific Stock List ---
router.get('/:lid', async (req, res) => {
    const { lid } = req.params;

    try {
        // Fetch stocks in the stock list
        const stocksResult = await pool.query(
            `SELECT sli.stock AS symbol, sli.shares,
                CAST(STDDEV(sd.close) / AVG(sd.close) AS FLOAT) AS coefficient_of_variation,
                (COVAR_POP(sd.close, spy.close) / VAR_POP(spy.close)) AS beta
         FROM stocklistitems sli
         JOIN stockdata sd ON sli.stock = sd.stock
         JOIN stockdata spy ON spy.stock = 'SPY' AND spy.date = sd.date
         WHERE sli.lid = $1
         GROUP BY sli.stock, sli.shares`,
            [lid]
        );

        // if (stocksResult.rows.length === 0) {
        //     return res.status(404).json({ error: 'No stocks found in this stock list' });
        // }

        // Fetch correlation matrix for stocks in the list
        const correlationResult = await pool.query(
            `SELECT s1.stock AS stock1, s2.stock AS stock2,
                CORR(s1.close, s2.close) AS value
         FROM stockdata s1
         JOIN stockdata s2 ON s1.date = s2.date
         WHERE s1.stock IN (SELECT stock FROM stocklistitems WHERE lid = $1)
           AND s2.stock IN (SELECT stock FROM stocklistitems WHERE lid = $1)
           AND s1.stock < s2.stock
         GROUP BY s1.stock, s2.stock`,
            [lid]
        );

        // if (correlationResult.rows.length === 0) {
        //     return res.status(404).json({ error: 'No correlation data found for this stock list' });
        // }

        res.json({
            stocks: stocksResult.rows,
            correlationMatrix: correlationResult.rows,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch stock list details' });
    }
});

// --- Delete a Stock List ---
router.delete('/:lid', async (req, res) => {
    const { lid } = req.params;
    const userId = req.user.email;

    try {
        // Ensure the stock list belongs to the user
        const stockListResult = await pool.query(
            `SELECT * FROM stocklists WHERE lid = $1 AND uid = $2`,
            [lid, userId]
        );

        if (stockListResult.rows.length === 0) {
            return res.status(404).json({ error: 'Stock list not found or unauthorized' });
        }

        // Delete the stock list
        await pool.query(`DELETE FROM stocklists WHERE lid = $1`, [lid]);
        res.json({ message: 'Stock list deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete stock list' });
    }
});

// --- Share a Stock List ---
router.post('/:lid/share', async (req, res) => {
    const lid = parseInt(req.params.lid); // Cast lid to an integer
    const { email } = req.body; // Email of the user to share with
    const userId = req.user.email; // Current user's email

    try {
        // Step 1: Check if the stock list belongs to the current user
        const ownershipCheck = await pool.query(
            `SELECT * FROM stocklists WHERE lid = $1 AND uid = $2`,
            [lid, userId]
        );

        if (ownershipCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Stock list not found or unauthorized' });
        }

        // Step 2: Check if the recipient is a friend of the current user
        const friendshipCheck = await pool.query(
            `SELECT * FROM friends
             WHERE (sender = $1 AND receiver = $2 AND status = 'accepted')
                OR (sender = $2 AND receiver = $1 AND status = 'accepted')`,
            [userId, email]
        );

        if (friendshipCheck.rows.length === 0) {
            return res.status(400).json({ error: 'The user is not your friend.' });
        }

        // Step 3: Insert the shared record into the stocklistsharedwith table
        const insertShared = await pool.query(
            `INSERT INTO stocklistsharedwith (lid, email)
             VALUES ($1, $2)
             ON CONFLICT (lid, email) DO NOTHING
             RETURNING *`,
            [lid, email]
        );

        if (insertShared.rows.length === 0) {
            return res.status(400).json({ error: 'Failed to share stock list. It may already be shared with this user.' });
        }

        // Step 4: Update the stock list visibility to "shared"
        await pool.query(
            `UPDATE stocklists SET visibility = 'shared' WHERE lid = $1`,
            [lid]
        );

        res.json({ message: `Stock list shared with ${email}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Change Stock List Visibility
router.put('/:lid/visibility', async (req, res) => {
    const { lid } = req.params; // Stock list ID
    const { visibility } = req.body; // New visibility value (public or private)
    const userId = req.user.email; // Current user ID
  
    // Validate the visibility value
    if (!['public', 'private'].includes(visibility)) {
      return res.status(400).json({ error: 'Invalid visibility value. Must be "public" or "private".' });
    }
  
    try {
      // Ensure the stock list belongs to the user
      const stockListResult = await pool.query(
        `SELECT visibility FROM stocklists WHERE lid = $1 AND uid = $2`,
        [lid, userId]
      );
  
      if (stockListResult.rows.length === 0) {
        return res.status(404).json({ error: 'Stock list not found or unauthorized' });
      }
  
      const currentVisibility = stockListResult.rows[0].visibility;
  
      // If the current visibility is "shared", delete all entries in stocklistsharedwith
      if (currentVisibility === 'shared') {
        await pool.query(
          `DELETE FROM stocklistsharedwith WHERE lid = $1`,
          [lid]
        );
      }
  
      // Update the visibility of the stock list
      const updateResult = await pool.query(
        `UPDATE stocklists SET visibility = $1 WHERE lid = $2 AND uid = $3 RETURNING *`,
        [visibility, lid, userId]
      );
  
      if (updateResult.rows.length === 0) {
        return res.status(400).json({ error: 'Failed to update stock list visibility.' });
      }
  
      res.json({ message: `Stock list visibility updated to ${visibility}.` });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update stock list visibility.' });
    }
  });

module.exports = router;