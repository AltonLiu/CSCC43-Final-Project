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
            'SELECT pid, name, CAST(money AS FLOAT) FROM portfolios WHERE pid = $1',
            [pid]
        );

        if (portfolioResult.rows.length === 0) {
            return res.status(404).json({ error: 'Portfolio not found' });
        }

        const portfolio = portfolioResult.rows[0];

        // Fetch holdings for the portfolio
        const holdingsResult = await pool.query(
            `SELECT h.stock AS stock, 
                    SUM(h.shares) AS shares, 
                    CAST(MAX(s.close) AS FLOAT) AS close
             FROM holdings h
             JOIN stockdata s ON h.stock = s.stock
             WHERE h.pid = $1 AND s.date = (SELECT MAX(date) FROM stockdata WHERE stock = h.stock)
             GROUP BY h.stock
             HAVING SUM(h.shares) > 0`,
            [pid]
        );

        portfolio.holdings = holdingsResult.rows;

        // Calculate total stock value
        const totalStockValue = holdingsResult.rows.reduce((sum, holding) => {
            return sum + holding.shares * holding.close;
        }, 0);

        portfolio.totalStockValue = totalStockValue;

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

router.post('/:pid/buy', async (req, res) => {
    const { pid } = req.params; // Portfolio ID
    const { stock, shares } = req.body; // Stock symbol and number of shares

    try {
        // Ensure the stock exists in the stocks table
        const stockExists = await pool.query('SELECT * FROM stocks WHERE symbol = $1', [stock]);
        if (stockExists.rows.length === 0) {
            return res.status(400).json({ error: 'Stock does not exist' });
        }

        // Fetch the portfolio's cash and the stock's latest price
        const portfolioResult = await pool.query('SELECT money FROM portfolios WHERE pid = $1', [pid]);
        if (portfolioResult.rows.length === 0) {
            return res.status(404).json({ error: 'Portfolio not found' });
        }
        const { money } = portfolioResult.rows[0];

        const stockPriceResult = await pool.query(
            `SELECT close FROM stockdata WHERE stock = $1 ORDER BY date DESC LIMIT 1`,
            [stock]
        );
        if (stockPriceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Stock price not found' });
        }
        const stockPrice = stockPriceResult.rows[0].close;

        // Calculate the total cost of the purchase
        const totalCost = stockPrice * shares;
        if (totalCost > money) {
            return res.status(400).json({ error: 'Insufficient funds in the portfolio' });
        }

        // Insert or update the holdings table
        await pool.query(
            `INSERT INTO holdings (pid, stock, shares)
             VALUES ($1, $2, $3)`,
            [pid, stock, shares]
        );

        // Deduct the cost from the portfolio's cash
        await pool.query(
            'UPDATE portfolios SET money = money - $1 WHERE pid = $2',
            [totalCost, pid]
        );

        res.json({ message: 'Stock purchased successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to buy stock' });
    }
});

router.post('/:pid/sell', async (req, res) => {
    const { pid } = req.params; // Portfolio ID
    const { stock, shares } = req.body; // Stock symbol and number of shares

    try {
        // Check if the stock exists in the portfolio
        const holdingResult = await pool.query(
            'SELECT SUM(shares) AS totalShares FROM holdings WHERE pid = $1 AND stock = $2',
            [pid, stock]
        );

        if (holdingResult.rows.length === 0 || holdingResult.rows[0].totalshares === null) {
            return res.status(400).json({ error: 'Stock not found in portfolio' });
        }

        const currentShares = holdingResult.rows[0].totalshares;

        if (shares > currentShares) {
            return res.status(400).json({ error: 'Not enough shares to sell' });
        }

        // Get the latest stock price
        const stockPriceResult = await pool.query(
            `SELECT close FROM stockdata WHERE stock = $1 ORDER BY date DESC LIMIT 1`,
            [stock]
        );

        if (stockPriceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Stock price not found' });
        }

        const stockPrice = stockPriceResult.rows[0].close;
        const totalValue = stockPrice * shares;

        // Update holdings and portfolio cash
        await pool.query('BEGIN');

        // Add a new transaction to the holdings table with negative shares
        await pool.query(
            `INSERT INTO holdings (pid, stock, shares)
             VALUES ($1, $2, $3)`,
            [pid, stock, -shares]
        );

        // Add the money to the portfolio
        await pool.query(
            'UPDATE portfolios SET money = money + $1 WHERE pid = $2',
            [totalValue, pid]
        );

        await pool.query('COMMIT');

        res.json({ message: 'Stock sold successfully', cashAdded: totalValue });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Failed to sell stock' });
    }
});

router.delete('/:pid', async (req, res) => {
    const { pid } = req.params;

    try {
        // Delete the portfolio
        const result = await pool.query('DELETE FROM portfolios WHERE pid = $1 RETURNING *', [pid]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Portfolio not found' });
        }

        res.json({ message: 'Portfolio deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete portfolio' });
    }
});

module.exports = router;