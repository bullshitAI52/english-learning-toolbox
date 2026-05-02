const express = require('express');
const db = require('./db');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Admin only: Get pending users
router.get('/admin/pending-users', authenticateToken, (req, res) => {
    // Check if user is admin
    db.get('SELECT is_admin FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user || !user.is_admin) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Get pending users
        db.all('SELECT id, email, created_at FROM users WHERE approved = 0 AND is_admin = 0', [], (err, users) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ users });
        });
    });
});

// Admin only: Approve user
router.post('/admin/approve-user', authenticateToken, (req, res) => {
    const { userId } = req.body;

    // Check if user is admin
    db.get('SELECT is_admin FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user || !user.is_admin) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Approve user
        db.run('UPDATE users SET approved = 1 WHERE id = ?', [userId], function (err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'User approved successfully' });
        });
    });
});

// Admin only: Reject user
router.post('/admin/reject-user', authenticateToken, (req, res) => {
    const { userId } = req.body;

    // Check if user is admin
    db.get('SELECT is_admin FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user || !user.is_admin) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Delete user
        db.run('DELETE FROM users WHERE id = ?', [userId], function (err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'User rejected and deleted' });
        });
    });
});

// Admin: Get pending password reset codes
router.get('/admin/reset-codes', authenticateToken, (req, res) => {
    db.get('SELECT is_admin FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user || !user.is_admin) return res.status(403).json({ error: 'Unauthorized' });

        db.all('SELECT r.id, r.code, r.expires_at, r.used, r.created_at, u.email FROM password_resets r JOIN users u ON r.user_id = u.id WHERE r.used = 0 AND r.expires_at > ? ORDER BY r.id DESC',
            [Date.now()], (err2, codes) => {
                if (err2) return res.status(500).json({ error: 'Database error' });
                res.json({ codes });
            });
    });
});

module.exports = router;
