const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const pool = require('../db');

const router = express.Router();
const SALT_ROUNDS = 10;

// Register
router.post('/register', async (req, res) => {
  const { email, name, password } = req.body;
  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  try {
    const result = await pool.query(
      'INSERT INTO users(email, name, password) VALUES($1, $2, $3) RETURNING email',
      [email, name, hashed]
    );
    res.status(201).json({ userEmail: result.rows[0].email });
  } catch (e) {
    res.status(400).json({ error: e.detail });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { loginEmail, password } = req.body;
  const user = await pool.query('SELECT * FROM users WHERE email=$1', [loginEmail]);
  if (!user.rows.length) return res.status(400).json({ error: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, user.rows[0].password);
  if (!valid) return res.status(400).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ email: user.rows[0].email, name: user.rows[0].name }, process.env.JWT_SECRET);
  res.json({ token });
});

module.exports = router;