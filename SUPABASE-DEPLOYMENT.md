# Supabase 版本部署指南

## 📋 准备工作

由于当前的 `index.html` 使用的是自定义 Node.js 后端，您需要创建一个新的 Supabase 版本。

## 🚀 快速部署步骤

### 方案 A：创建新仓库（推荐）

#### 1. 在 GitHub 创建新仓库
1. 访问 https://github.com/new
2. Repository name: `english-learning-toolbox-supabase`
3. Public
4. **不要** Initialize with README
5. 创建

#### 2. 在本地准备文件

```bash
# 创建新目录
cd ~
mkdir english-learning-toolbox-supabase
cd english-learning-toolbox-supabase

# 初始化 Git
git init
git branch -M main

# 复制必要文件
cp /Users/apple/english-learning-toolbox/supabase-schema.sql .
cp /Users/apple/english-learning-toolbox/vercel.json .
cp /Users/apple/english-learning-toolbox/README-SUPABASE.md README.md

# 复制词库数据（如果有）
cp -r /Users/apple/english-learning-toolbox/data . 2>/dev/null || true
```

#### 3. 创建 Supabase 版本的 index.html

**重要**：由于当前 index.html 已经改用自定义后端，您需要：

**选项 1**：从 Git 历史恢复早期的 Supabase 版本
```bash
cd /Users/apple/english-learning-toolbox
git log --oneline | grep -i supabase
# 找到最后一个使用 Supabase 的提交
git show <commit-hash>:index.html > ~/english-learning-toolbox-supabase/index.html
```

**选项 2**：我帮您创建一个新的 Supabase 版本
- 需要修改约 500 行代码
- 移除 Node.js API 调用
- 添加 Supabase SDK
- 更新认证逻辑

#### 4. 配置 Supabase

1. 访问 https://supabase.com
2. 创建新项目
3. 项目名称：english-learning-toolbox
4. 区域：选择离您最近的（如 Singapore）
5. 生成强密码并保存
6. 等待项目创建完成（约2分钟）

7. 执行 SQL Schema：
   - 左侧菜单 → SQL Editor
   - 点击 "+ New query"
   - 粘贴 `supabase-schema.sql` 内容
   - 点击 "Run"

8. 获取连接信息：
   - 左侧菜单 → Settings → API
   - 复制 `Project URL` 和 `anon public` key

#### 5. 更新 index.html 配置

在 index.html 中找到：
```javascript
const SUPABASE_URL = 'YOUR_PROJECT_URL';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

替换为您的实际值。

#### 6. 推送到 GitHub

```bash
cd ~/english-learning-toolbox-supabase
git add .
git commit -m "Initial commit: Supabase version"
git remote add origin https://github.com/YOUR_USERNAME/english-learning-toolbox-supabase.git
git push -u origin main
```

#### 7. 部署到 Vercel

```bash
npm install -g vercel
vercel login
vercel
```

按提示操作：
1. Set up and deploy? **Y**
2. Which scope? 选择您的账号
3. Link to existing project? **N**
4. Project name? `english-learning-toolbox-supabase`
5. Directory? `./`
6. Override settings? **N**

部署完成后会给您一个 URL，例如：
```
https://english-learning-toolbox-supabase.vercel.app
```

#### 8. 设置管理员

在 Supabase Dashboard → SQL Editor：

```sql
-- 先注册您的账号，然后执行：
UPDATE user_profiles 
SET is_admin = TRUE, approved = TRUE 
WHERE email = 'your@email.com';
```

### 方案 B：使用当前仓库的新分支

```bash
cd /Users/apple/english-learning-toolbox
git checkout -b supabase-version
# 删除 server 目录
rm -rf server
# 添加 Supabase 文件
git add .
git commit -m "Create Supabase version"
git push origin supabase-version
```

## ⚠️ 当前状态

已创建文件：
- ✅ `supabase-schema.sql` - 数据库架构
- ✅ `vercel.json` - Vercel 配置
- ✅ `README-SUPABASE.md` - 部署说明

需要创建：
- ⏳ Supabase 版本的 `index.html`

## 🤔 需要帮助吗？

如果您想让我创建完整的 Supabase 版本 index.html，请告诉我：
1. 我会基于当前版本修改所有代码
2. 替换自定义后端为 Supabase
3. 测试所有功能

或者您可以选择从 Git 历史恢复早期的 Supabase 版本（更快）。
