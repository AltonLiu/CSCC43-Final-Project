const express = require('express');
const pool = require('../db');
const router = express.Router();
require('dotenv').config();

// Get all portfolios for a user
router.get('/', async (req, res) => {
    const { email, name } = req.user;

    try {
        // Fetch all portfolios for the user
        const portfoliosResult = await pool.query(
            'SELECT pid, name, money FROM portfolios WHERE uid = $1',
            [email]
        );

        const portfolios = portfoliosResult.rows;

        // Fetch holdings for each portfolio
        for (const portfolio of portfolios) {
            const holdingsResult = await pool.query(
                `SELECT h.stock, h.shares, s.close
           FROM holdings h
           JOIN stockdata s ON h.stock = s.stock
           WHERE h.pid = $1 AND s.date = (SELECT MAX(date) FROM stockdata WHERE stock = h.stock)`,
                [portfolio.pid]
            );
            portfolio.holdings = holdingsResult.rows;
        }

        res.json(portfolios);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch portfolios' });
    }
});

// Get a single portfolio by ID
router.get('/:pid', async (req, res) => {
    const { pid } = req.params;

    try {
        // Fetch portfolio details
        const portfolioResult = await pool.query(
            'SELECT pid, name, money FROM portfolios WHERE pid = $1',
            [pid]
        );

        if (portfolioResult.rows.length === 0) {
            return res.status(404).json({ error: 'Portfolio not found' });
        }

        const portfolio = portfolioResult.rows[0];

        // Fetch holdings for the portfolio
        const holdingsResult = await pool.query(
            `SELECT h.stock, h.shares, s.close
         FROM holdings h
         JOIN stockdata s ON h.stock = s.stock
         WHERE h.pid = $1 AND s.date = (SELECT MAX(date) FROM stockdata WHERE stock = h.stock)`,
            [pid]
        );

        portfolio.holdings = holdingsResult.rows;

        res.json(portfolio);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch portfolio' });
    }
});

router.post('/new', async (req, res) => {
    const portfolioName = req.body.name;
    const { email } = req.user; // Get the logged-in user's email from req.user

    try {
        const result = await pool.query(
            'INSERT INTO portfolios (uid, name, money) VALUES ($1, $2, 0) RETURNING *',
            [email, portfolioName]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create portfolio' });
    }
});

router.post('/:pid/deposit', async (req, res) => {
    const { pid } = req.params;
    const { amount } = req.body;

    try {
        // Update the portfolio's money
        await pool.query(
            'UPDATE portfolios SET money = money + $1 WHERE pid = $2',
            [amount, pid]
        );
        res.json({ message: 'Deposit successful' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to deposit money' });
    }
});

router.post('/:pid/withdraw', async (req, res) => {
    const { pid } = req.params;
    const { amount } = req.body;

    try {
        // Update the portfolio's money
        await pool.query(
            'UPDATE portfolios SET money = money - $1 WHERE pid = $2',
            [amount, pid]
        );
        res.json({ message: 'Withdrawal successful' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to withdraw money' });
    }
});

router.post('/transfer', async (req, res) => {
    const { fromPid, toPid, amount } = req.body;

    try {
        // Start a transaction
        await pool.query('BEGIN');

        // Deduct funds from the source portfolio
        const deductResult = await pool.query(
            'UPDATE portfolios SET money = money - $1 WHERE pid = $2 AND money >= $1 RETURNING *',
            [amount, fromPid]
        );

        if (deductResult.rows.length === 0) {
            throw new Error('Insufficient funds in the source portfolio.');
        }

        // Add funds to the destination portfolio
        await pool.query(
            'UPDATE portfolios SET money = money + $1 WHERE pid = $2',
            [amount, toPid]
        );

        // Commit the transaction
        await pool.query('COMMIT');

        res.json({ message: 'Transfer successful' });
    } catch (err) {
        // Rollback the transaction in case of an error
        await pool.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message || 'Failed to transfer funds' });
    }
});

module.exports = router;