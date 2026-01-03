const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

const email = process.argv[2];

if (!email) {
    console.log('用法: node set-admin.js your@email.com');
    process.exit(1);
}

// 首先添加字段（如果不存在）
db.run(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`, (err) => {
    // 忽略错误（可能字段已存在）
    db.run(`ALTER TABLE users ADD COLUMN approved INTEGER DEFAULT 1`, (err) => {
        // 设置管理员
        db.run(`UPDATE users SET is_admin = 1, approved = 1 WHERE email = ?`, [email], function (err) {
            if (err) {
                console.error('错误:', err.message);
            } else if (this.changes === 0) {
                console.log('❌ 未找到该邮箱，请先注册账号！');
            } else {
                console.log('✅ 已将', email, '设为管理员！');
            }
            db.close();
        });
    });
});
