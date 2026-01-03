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

module.exports = router;
