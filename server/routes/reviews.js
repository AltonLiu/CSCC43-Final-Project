const express = require('express');
const pool = require('../db');
const router = express.Router();

router.post("/", async (req, res) => {
  const { email } = req.user;
  const { list, text } = req.body;

  try {
    await pool.query(
      "INSERT INTO reviews(lid, uid, text) VALUES($1, $2, $3)",
      [list, email, text]
    );
  } catch (e) {
    console.error(err);
    res.status(500).json({ error: "Failed to post review" });
  }
});

router.get("/", async (req, res) => {
  const { email } = req.user;

  try {
    const result = await pool.query(
      "SELECT name, r.uid, text FROM reviews AS r JOIN stocklists AS s ON r.lid = s.lid"
    );
    res.status(200).json(result.rows);
  } catch (e) {
    console.error(err);
    res.status(500).json({ error: "Failed to get reviews" });
  }
});

router.patch("/", async (req, res) => {
  const { email } = req.user;
  const { list, text } = req.body;

  try {
    await pool.query(
      "UPDATE reviews SET text = $1 WHERE lid = $2 AND uid = $3",
      [text, list, email]
    );
  } catch (e) {
    console.error(err);
    res.status(500).json({ error: "Failed to edit review" });
  }
});

router.delete("/", async (req, res) => {
  const { email } = req.user;
  const { lid, uid } = req.body;

  try {
    const owner = await pool.query(
      `SELECT r.uid FROM reviews AS r JOIN stocklists AS s ON r.lid = s.lid
      WHERE r.lid = $1 AND r.uid = $2`,
      [lid, uid]
    );

    // Can only delete if you own the list or own the review
    if (owner !== email && uid !== email) {
      res.status(403).json({ error: "You don't have permission to delete that" });
      return;
    }

    await pool.query(
      "DELETE FROM reviews WHERE lid = $1 AND uid = $2",
      [list, uid]
    );
  } catch (e) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete review" });
  }
});

module.exports = router;
