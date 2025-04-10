const express = require('express');
const pool = require('../db');
const router = express.Router();
require('dotenv').config();

router.get('/:symbol/history', async (req, res) => {
    const { symbol } = req.params;

    try {
        // Fetch historical data for the stock
        const stockHistoryResult = await pool.query(
            `SELECT date, open, high, low, close, volume
             FROM stockdata
             WHERE stock = $1
             ORDER BY date ASC`,
            [symbol]
        );

        if (stockHistoryResult.rows.length === 0) {
            return res.status(404).json({ error: 'No historical data found for this stock' });
        }

        res.json(stockHistoryResult.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch stock history' });
    }
});

router.post('/new', async (req, res) => {
    const { symbol, date, open, close, high, low, volume } = req.body;
  
    try {
      await pool.query('BEGIN');
  
      // Insert or update the stock in the "stock" table
      await pool.query(
        `INSERT INTO stock (symbol)
         VALUES ($1)
         ON CONFLICT (symbol) DO NOTHING`,
        [symbol]
      );
  
      // Insert the stock data into the "stockdata" table
      await pool.query(
        `INSERT INTO stockdata (stock, date, open, high, low, close, volume)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (stock, date) DO UPDATE
         SET open = EXCLUDED.open,
             high = EXCLUDED.high,
             low = EXCLUDED.low,
             close = EXCLUDED.close,
             volume = EXCLUDED.volume`,
        [symbol, date, open, high, low, close, volume]
      );
  
      await pool.query('COMMIT');
      res.status(201).json({ message: 'Stock data added successfully' });
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: 'Failed to add stock data' });
    }
  });

module.exports = router;