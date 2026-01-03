const express = require('express');
const db = require('./db');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Get user progress
router.get('/progress', authenticateToken, (req, res) => {
    db.get(
        'SELECT last_file, last_content, last_page FROM user_progress WHERE user_id = ?',
        [req.user.id],
        (err, progress) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ progress: progress || {} });
        }
    );
});

// Update user progress
router.put('/progress', authenticateToken, (req, res) => {
    const { last_file, last_content, last_page } = req.body;

    db.run(
        `INSERT INTO user_progress (user_id, last_file, last_content, last_page, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       last_file = excluded.last_file,
       last_content = excluded.last_content,
       last_page = excluded.last_page,
       updated_at = CURRENT_TIMESTAMP`,
        [req.user.id, last_file, last_content, last_page],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'Progress saved successfully' });
        }
    );
});

// Get all word stats for user
router.get('/stats', authenticateToken, (req, res) => {
    db.all(
        'SELECT word, correct, wrong, last_practiced FROM user_stats WHERE user_id = ?',
        [req.user.id],
        (err, stats) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ stats: stats || [] });
        }
    );
});

// Upsert word stat
router.post('/stats', authenticateToken, (req, res) => {
    const { word, correct, wrong, last_practiced } = req.body;

    if (!word) {
        return res.status(400).json({ error: 'Word is required' });
    }

    db.run(
        `INSERT INTO user_stats (user_id, word, correct, wrong, last_practiced)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, word) DO UPDATE SET
       correct = excluded.correct,
       wrong = excluded.wrong,
       last_practiced = excluded.last_practiced`,
        [req.user.id, word, correct || 0, wrong || 0, last_practiced || Date.now()],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'Stats updated successfully' });
        }
    );
});

module.exports = router;
