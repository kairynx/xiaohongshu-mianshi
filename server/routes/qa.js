const express = require('express');
const router = express.Router();
const qa = require('../agent/qa');

router.post('/', async (req, res) => {
  try {
    const { question } = req.body;
    if (typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ success: false, error: 'question 必须是非空字符串' });
    }

    const userId = String(req.header('X-User-Id') || '').trim();
    const validUserId = userId && userId.length >= 2 && userId.length <= 64 ? userId : null;

    const result = await qa.askQuestion(question, validUserId);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
