const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-this';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Register endpoint
router.post('/register', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password || password.length < 6) {
        return res.status(400).json({ error: 'Email and password (min 6 chars) required' });
    }

    try {
        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Insert user
        db.run(
            'INSERT INTO users (email, password_hash) VALUES (?, ?)',
            [email, passwordHash],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(400).json({ error: 'Email already exists' });
                    }
                    return res.status(500).json({ error: 'Database error' });
                }

                // Create initial progress entry
                db.run(
                    'INSERT INTO user_progress (user_id) VALUES (?)',
                    [this.lastID]
                );

                // Generate token (even for unapproved users)
                const token = jwt.sign({ id: this.lastID, email, is_admin: 0 }, JWT_SECRET, { expiresIn: '7d' });

                res.json({
                    message: '注册成功！您的账号正在等待管理员审核。',
                    token,
                    user: { id: this.lastID, email, approved: 0, is_admin: 0 }
                });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Login endpoint
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if user is approved
        if (!user.approved && !user.is_admin) {
            return res.status(403).json({ error: '您的账号正在审核中，请等待管理员批准' });
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = jwt.sign({ id: user.id, email: user.email, is_admin: user.is_admin || 0 }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, email: user.email, is_admin: user.is_admin || 0 }
        });
    });
});

// Get current user
router.get('/me', authenticateToken, (req, res) => {
    db.get('SELECT id, email, is_admin, approved, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
    });
});

module.exports = { router, authenticateToken };
