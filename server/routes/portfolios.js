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

        // Calculate coefficient of variation and beta for each stock
        const statsResult = await pool.query(
            `SELECT stockdata.stock AS stock,
                    CAST(STDDEV(stockdata.close) / AVG(stockdata.close) AS FLOAT) AS coefficient_of_variation,
                    (COVAR_POP(stockdata.close, spy_data.close) / VAR_POP(spy_data.close)) AS beta
             FROM stockdata
             JOIN stockdata spy_data 
               ON spy_data.stock = 'SPY' AND spy_data.date = stockdata.date
             WHERE stockdata.stock IN (SELECT stock FROM holdings WHERE pid = $1)
             GROUP BY stockdata.stock`,
            [pid]
        );

        // Add stats to each stock in holdings
        portfolio.holdings = portfolio.holdings.map(holding => {
            const stats = statsResult.rows.find(stat => stat.stock === holding.stock);
            return {
                ...holding,
                coefficient_of_variation: stats ? stats.coefficient_of_variation : null,
                beta: stats ? stats.beta : null,
            };
        });

        // Calculate correlation matrix for stocks in the portfolio
        const correlationResult = await pool.query(
            `SELECT s1.stock AS stock1, s2.stock AS stock2, 
                    CORR(s1.close, s2.close) AS correlation
             FROM stockdata s1
             JOIN stockdata s2 ON s1.date = s2.date
             WHERE s1.stock IN (SELECT stock FROM holdings WHERE pid = $1)
               AND s2.stock IN (SELECT stock FROM holdings WHERE pid = $1)
               AND s1.stock < s2.stock
             GROUP BY s1.stock, s2.stock`,
            [pid]
        );

        portfolio.correlationMatrix = correlationResult.rows;

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
        await pool.query('BEGIN');

        // Update portfolio cash
        await pool.query(
            'UPDATE portfolios SET money = money + $1 WHERE pid = $2',
            [amount, pid]
        );

        // Record the cash transaction
        await pool.query(
            `INSERT INTO cashtransactions (pid, amount, source, destination)
             VALUES ($1, $2, 'external', (SELECT name FROM portfolios WHERE pid = $1))`,
            [pid, amount]
        );

        await pool.query('COMMIT');
        res.json({ message: 'Deposit successful' });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Failed to deposit cash' });
    }
});

router.post('/:pid/withdraw', async (req, res) => {
    const { pid } = req.params;
    const { amount } = req.body;

    try {
        await pool.query('BEGIN');

        // Update portfolio cash
        const result = await pool.query(
            'UPDATE portfolios SET money = money - $1 WHERE pid = $2 AND money >= $1',
            [amount, pid]
        );

        if (result.rowCount === 0) {
            throw new Error('Insufficient funds to withdraw.');
        }

        // Record the cash transaction
        await pool.query(
            `INSERT INTO cashtransactions (pid, amount, source, destination)
             VALUES ($1, $2, (SELECT name FROM portfolios WHERE pid = $1), 'external')`,
            [pid, -amount]
        );

        await pool.query('COMMIT');
        res.json({ message: 'Withdrawal successful' });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/transfer', async (req, res) => {
    const { fromPid, toPid, amount } = req.body;

    try {
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

        // Record the cash transaction
        await pool.query(
            `INSERT INTO cashtransactions (pid, amount, source, destination)
             VALUES ($1, $2, (SELECT name FROM portfolios WHERE pid = $1), (SELECT name FROM portfolios WHERE pid = $3))`,
            [fromPid, -amount, toPid]
        );
        await pool.query(
            `INSERT INTO cashtransactions (pid, amount, source, destination)
             VALUES ($3, $2, (SELECT name FROM portfolios WHERE pid = $1), (SELECT name FROM portfolios WHERE pid = $3))`,
             [fromPid, amount, toPid]
        );

        await pool.query('COMMIT');
        res.json({ message: 'Transfer successful' });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Failed to transfer funds' });
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

router.get('/:pid/transactions', async (req, res) => {
    const { pid } = req.params;

    try {
        // Fetch cash transactions
        const cashTransactions = await pool.query(
            `SELECT CAST(amount AS FLOAT), source, destination
             FROM cashtransactions
             WHERE pid = $1
             ORDER BY tid DESC`,
            [pid]
        );

        // Fetch stock transactions (from the holdings table)
        const stockTransactions = await pool.query(
            `SELECT stock, shares
             FROM holdings
             WHERE pid = $1
             ORDER BY tid DESC`,
            [pid]
        );

        res.json({
            cashTransactions: cashTransactions.rows,
            stockTransactions: stockTransactions.rows,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

module.exports = router;