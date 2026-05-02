const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('./auth');
const db = require('./db');

const router = express.Router();
const WORDLISTS_DIR = path.join(__dirname, 'shared_wordlists');

const storage = multer.diskStorage({
    destination: WORDLISTS_DIR,
    filename: (req, file, cb) => {
        const safeName = Buffer.from(file.originalname, 'latin1').toString('utf8').replace(/[^a-zA-Z0-9一-鿿._-]/g, '_');
        cb(null, Date.now() + '-' + safeName);
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// List shared wordlists
router.get('/wordlists', authenticateToken, (req, res) => {
    fs.readdir(WORDLISTS_DIR, (err, files) => {
        if (err) return res.json({ files: [] });
        const list = files.filter(f => f.endsWith('.csv') || f.endsWith('.txt'))
            .map(f => {
                const stat = fs.statSync(path.join(WORDLISTS_DIR, f));
                return { name: f, size: stat.size, uploaded: stat.mtime };
            })
            .sort((a, b) => b.uploaded - a.uploaded);
        res.json({ files: list });
    });
});

// Get shared wordlist content
router.get('/wordlists/:filename', authenticateToken, (req, res) => {
    const filePath = path.join(WORDLISTS_DIR, path.basename(req.params.filename));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.sendFile(filePath);
});

// Admin upload wordlist
router.post('/admin/upload-wordlist', authenticateToken, (req, res) => {
    db.get('SELECT is_admin FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user || !user.is_admin) return res.status(403).json({ error: 'Unauthorized' });

        upload.single('file')(req, res, (err2) => {
            if (err2) return res.status(400).json({ error: 'Upload failed: ' + err2.message });
            if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
            res.json({ message: '上传成功！所有用户现在可以使用该词库', filename: req.file.filename });
        });
    });
});

// Admin delete wordlist
router.delete('/admin/wordlists/:filename', authenticateToken, (req, res) => {
    db.get('SELECT is_admin FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user || !user.is_admin) return res.status(403).json({ error: 'Unauthorized' });
        const filePath = path.join(WORDLISTS_DIR, path.basename(req.params.filename));
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.json({ message: 'Deleted' });
    });
});

module.exports = router;
