const express = require('express');
const db = require('./db');
const { authenticateToken } = require('./auth');

const router = express.Router();

// SM-2 algorithm
function sm2(quality, prevEF, prevInterval, prevReps) {
    let ef = prevEF || 2.5;
    let interval = 0;
    let reps = 0;

    if (quality >= 3) {
        if (prevReps === 0) interval = 1;
        else if (prevReps === 1) interval = 6;
        else interval = Math.round((prevInterval || 0) * ef);
        reps = (prevReps || 0) + 1;
    }

    ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (ef < 1.3) ef = 1.3;

    const nextReview = Date.now() + interval * 86400000;
    return { ef, interval, repetitions: reps, nextReview };
}

// Get user progress
router.get('/progress', authenticateToken, (req, res) => {
    db.get(
        'SELECT last_file, last_content, last_page FROM user_progress WHERE user_id = ?',
        [req.user.id],
        (err, progress) => {
            if (err) return res.status(500).json({ error: 'Database error' });
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
            if (err) { console.error(err); return res.status(500).json({ error: 'Database error' }); }
            res.json({ message: 'Progress saved successfully' });
        }
    );
});

// Get all word stats
router.get('/stats', authenticateToken, (req, res) => {
    db.all(
        'SELECT word, correct, wrong, last_practiced, ef, interval_days, repetitions, next_review FROM user_stats WHERE user_id = ?',
        [req.user.id],
        (err, stats) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ stats: stats || [] });
        }
    );
});

// Get words due for review
router.get('/stats/review', authenticateToken, (req, res) => {
    const now = Date.now();
    db.all(
        'SELECT word, correct, wrong, last_practiced, ef, interval_days, repetitions, next_review FROM user_stats WHERE user_id = ? AND correct > 0 AND next_review <= ? ORDER BY next_review ASC',
        [req.user.id, now],
        (err, words) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ words: words || [] });
        }
    );
});

// Upsert word stat with SM-2
router.post('/stats', authenticateToken, (req, res) => {
    const { word, correct, wrong, last_practiced } = req.body;
    if (!word) return res.status(400).json({ error: 'Word is required' });

    // Get existing SM-2 params
    db.get('SELECT ef, interval_days, repetitions FROM user_stats WHERE user_id = ? AND word = ?',
        [req.user.id, word], (err, row) => {
            if (err) return res.status(500).json({ error: 'Database error' });

            const quality = correct ? 4 : (wrong ? 0 : 3);
            const prev = row || {};
            const result = sm2(quality, prev.ef || 2.5, prev.interval_days || 0, prev.repetitions || 0);

            db.run(
                `INSERT INTO user_stats (user_id, word, correct, wrong, last_practiced, ef, interval_days, repetitions, next_review)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(user_id, word) DO UPDATE SET
               correct = excluded.correct,
               wrong = excluded.wrong,
               last_practiced = excluded.last_practiced,
               ef = excluded.ef,
               interval_days = excluded.interval_days,
               repetitions = excluded.repetitions,
               next_review = excluded.next_review`,
                [req.user.id, word, correct || 0, wrong || 0, last_practiced || Date.now(),
                 result.ef, result.interval, result.repetitions, result.nextReview],
                (err2) => {
                    if (err2) { console.error(err2); return res.status(500).json({ error: 'Database error' }); }
                    res.json({
                        message: 'Stats updated',
                        sm2: { nextReview: result.nextReview, interval: result.interval, repetitions: result.repetitions, ef: parseFloat(result.ef.toFixed(2)) }
                    });
                }
            );
        });
});

// Record daily practice
router.post('/stats/daily', authenticateToken, (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const { words_practiced, correct_count, wrong_count } = req.body;
    db.run(
        "INSERT INTO daily_practice (user_id, date, words_practiced, correct_count, wrong_count) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, date) DO UPDATE SET words_practiced = words_practiced + excluded.words_practiced, correct_count = correct_count + excluded.correct_count, wrong_count = wrong_count + excluded.wrong_count",
        [req.user.id, today, words_practiced || 0, correct_count || 0, wrong_count || 0],
        (err) => { if (err) return res.status(500).json({ error: 'Database error' }); res.json({ message: 'Saved' }); }
    );
});

// Get daily stats
router.get('/stats/daily', authenticateToken, (req, res) => {
    db.all(
        "SELECT date, words_practiced, correct_count, wrong_count FROM daily_practice WHERE user_id = ? AND date >= date('now', '-30 days') ORDER BY date ASC",
        [req.user.id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ daily: rows || [] });
        }
    );
});

module.exports = router;
