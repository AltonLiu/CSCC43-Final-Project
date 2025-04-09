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

module.exports = router;