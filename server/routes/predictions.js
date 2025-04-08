const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  const { stock, date } = req.body;
  // TODO: Return a dummy predicted price
  res.json({ stock, date, prediction: 123.45 });
});

module.exports = router;