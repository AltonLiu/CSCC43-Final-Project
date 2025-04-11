const express = require('express');
const pool = require('../db');
const router = express.Router();

router.post("/request/:email", async (req, res) => {
  const { email } = req.user;
  const receiver = req.params.email;

  try {
    // See if there is already a past request
    let result = await pool.query(
      "SELECT date, status FROM friends WHERE sender = $1 AND receiver = $2",
      [email, receiver]
    );

    // TODO: Make sure you can't request again too quickly

    if (result.rows) {
      // TODO: Also need to update date
      await pool.query(
        "UPDATE friends SET status = 'pending' WHERE sender = $1 and receiver = $2",
        [email, receiver]
      );
    } else {
      await pool.query(
        "INSERT INTO friends(sender, receiver, status) VALUES($1, $2, 'pending')",
        [email, receiver]
      );
    }
    res.status(200).json({ msg: "Friend request sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send friend request" });
  }
});

module.exports = router;
