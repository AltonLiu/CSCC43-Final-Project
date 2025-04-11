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
      `INSERT INTO stocks (symbol)
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

router.post('/predict', async (req, res) => {
  const { stock, range } = req.body;

  try {
    // Fetch historical data for the stock
    const stockHistoryResult = await pool.query(
      `SELECT date, close
         FROM stockdata
         WHERE stock = $1
         ORDER BY date ASC`,
      [stock]
    );

    if (stockHistoryResult.rows.length === 0) {
      return res.status(404).json({ error: 'No historical data found for this stock' });
    }

    // Prepare data for linear regression
    const historicalData = stockHistoryResult.rows.map((row, index) => ({
      x: index + 1, // Use the index as the x-axis (time)
      y: parseFloat(row.close), // Use the close price as the y-axis
    }));

    // Calculate linear regression
    const { slope, intercept } = calculateLinearRegression(historicalData);

    // Get the most recent date from the historical data
    const mostRecentDate = new Date(stockHistoryResult.rows[stockHistoryResult.rows.length - 1].date);

    // Generate predictions
    const predictions = [];
    const startIndex = historicalData.length + 1; // Start predicting after the last historical data point
    const daysToPredict = range === 'week' ? 7 : range === 'month' ? 30 : 365;

    for (let i = 0; i < daysToPredict; i++) {
      const x = startIndex + i;
      const predictedPrice = slope * x + intercept;

      // Calculate the predicted date
      const predictedDate = new Date(mostRecentDate);
      predictedDate.setDate(predictedDate.getDate() + i + 1);

      predictions.push({
        date: predictedDate.toISOString().split('T')[0],
        price: predictedPrice.toFixed(2),
      });
    }

    res.json({ stock, range, predictions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate predictions' });
  }
});

// Helper function for linear regression
function calculateLinearRegression(data) {
  const n = data.length;
  const sumX = data.reduce((sum, point) => sum + point.x, 0);
  const sumY = data.reduce((sum, point) => sum + point.y, 0);
  const sumXY = data.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumX2 = data.reduce((sum, point) => sum + point.x * point.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

module.exports = router;