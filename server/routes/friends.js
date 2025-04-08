const express = require('express');
const pool = require('../db');
const router = express.Router();

router.post('/request', async (req, res) => {
  const { sender, receiver } = req.body;
  await pool.query(
    'INSERT INTO Friends(sender, receiver, status) VALUES($1, $2, $3)',
    [sender, receiver, 'pending']
  );
  res.json({ status: 'request sent' });
});

router.post('/respond', async (req, res) => {
  const { sender, receiver, status } = req.body;
  await pool.query(
    'UPDATE Friends SET status=$3 WHERE sender=$1 AND receiver=$2',
    [sender, receiver, status]
  );
  res.json({ status: 'updated' });
});

router.get('/:uid', async (req, res) => {
  const { uid } = req.params;
  const result = await pool.query(
    `SELECT * FROM Friends WHERE (sender=$1 OR receiver=$1) AND status='accepted'`,
    [uid]
  );
  res.json(result.rows);
});

module.exports = router;