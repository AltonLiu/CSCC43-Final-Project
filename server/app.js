const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');

const authRoutes = require('./routes/auth');
const portfolios = require('./routes/portfolios');
const stocklists = require('./routes/stocklists');
const friends = require('./routes/friends');
const reviews = require('./routes/reviews');
const predictions = require('./routes/predictions');
const stocks = require('./routes/stocks');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Middleware to authenticate and attach user info
function needsAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1]; // Extract the token
    try {
      const user = jwt.verify(token, process.env.JWT_SECRET); // Decode the token
      req.user = { email: user.email, name: user.name }; // Attach the user's name and email to req.user
    } catch (err) {
      console.error('Invalid token');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  } else {
    return res.status(401).json({ error: 'Authorization header missing' });
  }
  next();
}

// API
app.use('/api/auth', authRoutes);
app.use('/api/portfolios', needsAuth, portfolios);
app.use('/api/stocklists', needsAuth, stocklists);
app.use('/api/friends', needsAuth, friends);
app.use('/api/reviews', needsAuth, reviews);
app.use('/api/predictions', needsAuth, predictions);
app.use('/api/stocks', needsAuth, stocks);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
