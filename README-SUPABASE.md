# English Learning Toolbox - Supabase Version

[English](#english) | [中文](#中文)

## English

A vocabulary learning tool with spelling practice, cloud sync via Supabase, and admin approval workflow.

### Features

- 📚 CSV vocabulary import
- 🎯 Spelling practice with audio
- ☁️ Cloud sync across devices
- 👑 Admin approval system
- 🌓 Dark mode support
- 📱 Mobile responsive

### Live Demo

[Demo Link](https://your-vercel-app.vercel.app)

### Deployment

#### 1. Supabase Setup

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Go to SQL Editor and run `supabase-schema.sql`
4. Get your `Project URL` and `anon key` from Settings > API

#### 2. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/english-learning-toolbox-supabase)

Or manually:

```bash
npm install -g vercel
vercel login
vercel
```

#### 3. Environment Variables

Add in Vercel Dashboard > Settings > Environment Variables:

- `NEXT_PUBLIC_SUPABASE_URL` = Your Supabase Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Your Supabase anon key

#### 4. Update index.html

Replace Supabase config in `index.html`:

```javascript
const SUPABASE_URL = 'YOUR_PROJECT_URL';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

### Admin Setup

Set first user as admin in Supabase SQL Editor:

```sql
UPDATE user_profiles 
SET is_admin = TRUE, approved = TRUE 
WHERE email = 'your@email.com';
```

---

## 中文

一个支持拼写练习、Supabase 云端同步和管理员审核的单词学习工具。

### 功能特点

- 📚 CSV 词库导入
- 🎯 拼写练习（带发音）
- ☁️ 跨设备云端同步
- 👑 管理员审核系统
- 🌓 深色模式
- 📱 移动端适配

### 在线演示

[演示链接](https://your-vercel-app.vercel.app)

### 部署说明

#### 1. Supabase 配置

1. 在 [supabase.com](https://supabase.com) 创建账号
2. 创建新项目
3. 在 SQL Editor 执行 `supabase-schema.sql`
4. 在 Settings > API 获取 `Project URL` 和 `anon key`

#### 2. 部署到 Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/english-learning-toolbox-supabase)

或手动部署：

```bash
npm install -g vercel
vercel login
vercel
```

#### 3. 环境变量

在 Vercel Dashboard > Settings > Environment Variables 添加：

- `NEXT_PUBLIC_SUPABASE_URL` = Supabase 项目 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Supabase anon key

#### 4. 更新 index.html

修改 `index.html` 中的 Supabase 配置：

```javascript
const SUPABASE_URL = '你的项目URL';
const SUPABASE_ANON_KEY = '你的ANON_KEY';
```

### 管理员设置

在 Supabase SQL Editor 设置第一个管理员：

```sql
UPDATE user_profiles 
SET is_admin = TRUE, approved = TRUE 
WHERE email = 'your@email.com';
```

### License

MIT
