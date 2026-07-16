const express = require('express');
const router = express.Router();
const { convertFeeds } = require('../services/convert');

router.post('/convert', (req, res) => {
  const { results, category, keyword } = req.body;
  if (!results || !Array.isArray(results)) return res.status(400).json({ success: false, error: 'invalid results' });
  if (results.length > 200) return res.status(400).json({ success: false, error: 'too many results (max 200)' });

  const out = convertFeeds(results, category, keyword);
  res.json({ success: true, data: out, total: out.length });
});

module.exports = router;
