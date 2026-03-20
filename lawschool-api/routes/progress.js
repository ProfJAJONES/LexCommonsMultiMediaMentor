const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');

// Get all progress for logged in student
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT topic_id, card_index, step_index, completed_at FROM progress WHERE user_id = $1',
      [req.user.user_id]
    );
    res.json({ progress: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Save a completed step
router.post('/', requireAuth, async (req, res) => {
  const { topic_id, card_index, step_index } = req.body;
  if (!topic_id || card_index === undefined || step_index === undefined) {
    return res.status(400).json({ error: 'topic_id, card_index and step_index are required' });
  }
  try {
    await db.query(
      `INSERT INTO progress (user_id, topic_id, card_index, step_index)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, topic_id, card_index, step_index) DO NOTHING`,
      [req.user.user_id, topic_id, card_index, step_index]
    );
    res.json({ message: 'Progress saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Save a quiz score
router.post('/quiz', requireAuth, async (req, res) => {
  const { topic_id, card_index, step_index, score, total, outcome_scores } = req.body;
  try {
    await db.query(
      `INSERT INTO quiz_scores (user_id, topic_id, card_index, step_index, score, total, outcome_scores)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.user.user_id, topic_id, card_index, step_index, score, total, outcome_scores]
    );
    res.json({ message: 'Score saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get quiz scores for logged in student
router.get('/quiz', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT topic_id, card_index, step_index, score, total, outcome_scores, completed_at FROM quiz_scores WHERE user_id = $1',
      [req.user.user_id]
    );
    res.json({ scores: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;