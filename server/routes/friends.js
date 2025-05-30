const express = require('express');
const pool = require('../db');
const router = express.Router();

router.post("/requests", async (req, res) => {
  const { email } = req.user;
  const receiver = req.body.email;

  try {
    // Don't allow friending yourself
    if (email === receiver) {
      res.status(400).json({ error: "You cannot friend yourself" });
      return;
    }

    // Don't allow friending someone who requested you already
    let result = await pool.query(
      "SELECT sender FROM friends WHERE sender = $1 AND receiver = $2 AND status = 'pending'",
      [receiver, email]
    );
    if (result.rows.length > 0) {
      res.status(400).json({ error: "There is already a pending request from this user" });
      return;
    }

    // See if there is already a past request
    result = await pool.query(
      "SELECT date, status FROM friends WHERE sender = $1 AND receiver = $2",
      [email, receiver]
    );

    if (result.rows.length > 0) {
      const { status } = result.rows[0];
      const date = new Date(result.rows[0].date + "GMT"); // Things break unless I put this

      if (status === "pending") {
        res.status(400).json({ error: "There is already a pending request" });
        return;
      }
      if (status === "accepted") {
        res.status(400).json({ error: "You are already friends" });
        return;
      }
      if (new Date() - date < 5 * 60000) {
        res.status(400).json({ error: "You are sending requests too quickly, there is a 5 minute cooldown for friend requests" });
        return;
      }

      await pool.query(
        "UPDATE friends SET status = 'pending', date = NOW() WHERE sender = $1 AND receiver = $2",
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

router.get("/", async (req, res) => {
  const { email } = req.user;

  try {
    const result = await pool.query(
      `SELECT sender AS friend FROM friends WHERE receiver = $1 AND status = 'accepted'
      UNION SELECT receiver FROM friends WHERE sender = $1 AND status = 'accepted'`,
      [email]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get friends" });
  }
});

router.get("/requests/in", async (req, res) => {
  const { email } = req.user;

  try {
    const result = await pool.query(
      "SELECT sender FROM friends WHERE receiver = $1 AND status = 'pending'",
      [email]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get friend requests" });
  }
});

router.get("/requests/out", async (req, res) => {
  const { email } = req.user;

  try {
    const result = await pool.query(
      "SELECT receiver FROM friends WHERE sender = $1 AND status = 'pending'",
      [email]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get friend requests" });
  }
});

router.post("/manage", async (req, res) => {
  const { email } = req.user;
  const sender = req.body.email;
  const action = req.body.action + "ed";

  try {
    await pool.query(
      "UPDATE friends SET status = $1 WHERE sender = $2 AND receiver = $3",
      [action, sender, email]
    );
    res.status(200).json({ msg: "Friend status updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send friend request" });
  }
});

router.delete("/", async (req, res) => {
  const { email } = req.user;
  const friend = req.body.email;

  try {
    await pool.query(
      "DELETE FROM friends WHERE sender = $1 AND receiver = $2 OR sender = $2 AND receiver = $1",
      [email, friend]
    );
    res.status(200).json({ msg: "Friend deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete friend" });
  }
});

module.exports = router;
