const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');

// Get all bookmarks for current user
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM bookmarks WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.user_id]
    );
    res.json({ bookmarks: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add a bookmark
router.post('/', requireAuth, async (req, res) => {
  const { topic_id, card_index } = req.body;
  if (!topic_id || card_index === undefined) return res.status(400).json({ error: 'topic_id and card_index required' });
  try {
    await db.query(
      'INSERT INTO bookmarks (user_id, topic_id, card_index) VALUES ($1, $2, $3) ON CONFLICT (user_id, topic_id, card_index) DO NOTHING',
      [req.user.user_id, topic_id, card_index]
    );
    res.json({ message: 'Bookmarked' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove a bookmark
router.delete('/', requireAuth, async (req, res) => {
  const { topic_id, card_index } = req.body;
  try {
    await db.query(
      'DELETE FROM bookmarks WHERE user_id = $1 AND topic_id = $2 AND card_index = $3',
      [req.user.user_id, topic_id, card_index]
    );
    res.json({ message: 'Removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
