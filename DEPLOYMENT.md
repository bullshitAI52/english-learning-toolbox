# 英语单词学习工具箱 - 部署指南

## 项目架构

这个项目已经**完全重写**，使用 **Node.js + Express + SQLite** 后端，不再依赖 Supabase。

```
english-learning-toolbox/
├── server/              # Node.js 后端
│   ├── index.js        # Express 服务器
│   ├── db.js           # SQLite 数据库
│   ├── auth.js         # JWT 认证
│   ├── routes.js       # 数据同步 API
│   └── package.json    # 依赖管理
└── index.html          # 前端 (单页应用)
```

## 后端部署 (在您的服务器上)

### 1. 上传代码

将 `server/` 文件夹上传到您的服务器，例如：
```bash
/var/www/english-learning-toolbox/server/
```

### 2. 安装依赖

```bash
cd /var/www/english-learning-toolbox/server
npm install
```

### 3. 配置环境变量

复制 `.env.example` 并修改：
```bash
cp .env.example .env
nano .env
```

生成随机 JWT Secret：
```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
echo "PORT=3000" >> .env
```

### 4. 启动服务 (使用 PM2 保持运行)

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start index.js --name english-backend

# 开机自启
pm2 startup
pm2 save
```

### 5. 检查运行状态

```bash
pm2 status
pm2 logs english-backend
```

访问 `http://YOUR_SERVER_IP:3000/health` 应该返回 `{"status":"OK"}`

### 6. (可选) 配置 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api {
        proxy_pass http://localhost:3000/api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location / {
        root /var/www/english-learning-toolbox;
        try_files $uri /index.html;
    }
}
```

## 前端部署

### 1. 修改 API 地址

编辑 `index.html`，找到第 7-8 行左右：
```javascript
const API_BASE_URL = 'http://localhost:3000/api';
```

改为您的服务器地址：
```javascript
const API_BASE_URL = 'http://YOUR_SERVER_IP:3000/api';
// 或者如果配置了 Nginx
const API_BASE_URL = 'https://your-domain.com/api';
```

### 2. 部署前端

**方式 A: 直接放在服务器上**
```bash
# 上传 index.html 到服务器
scp index.html user@server:/var/www/english-learning-toolbox/
```

**方式 B: 继续使用 GitHub Pages**
```bash
# 提交代码
git add .
git commit -m "Rewrite with Node.js backend"
git push

# GitHub Pages 会自动发布
# 访问 https://YOUR_USERNAME.github.io/english-learning-toolbox/
```

## 使用说明

1. 打开网页 `https://your-domain.com/index.html`
2. 点击右上角 **"登录云端"**
3. 选择 **"注册新账号"** 输入邮箱和密码（≥6位）
4. 注册成功后自动登录
5. 开始背单词，进度会自动同步到您的服务器数据库！

## 数据库位置

所有用户数据存储在：
```
/var/www/english-learning-toolbox/server/database.sqlite
```

可以用 SQLite 客户端查看：
```bash
sqlite3 database.sqlite
.tables     # 查看所有表
SELECT * FROM users;  # 查看用户
```

## 故障排查

### 1. 无法连接后端
- 检查后端是否运行：`pm2 status`
- 检查防火墙：`sudo ufw allow 3000`
- 查看日志：`pm2 logs english-backend`

### 2. 跨域错误 (CORS)
后端已经配置 `cors()` 中间件，应该没问题。如果还有问题，可能是 Nginx 配置需要调整。

### 3. 数据库权限
确保 `database.sqlite` 文件有写权限：
```bash
chmod 664 database.sqlite
```

## 完成！

现在您拥有了一个完全自主可控的单词学习工具，不依赖任何第三方服务！🎉
