# 部署配置说明

## 环境要求

- Node.js 18+
- npm 或 pnpm

## 本地开发

1. 克隆仓库并安装依赖：

   ```bash
   npm install
   ```

2. 配置环境变量：复制 `.env.example` 为 `.env`，填写 Supabase 项目地址与 anon key：

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

3. 未配置 Supabase 时也可运行：使用演示账号 `demo` / `demo`，数据为前端模拟。

4. 启动开发服务器：

   ```bash
   npm run dev
   ```

   访问 http://localhost:5173

## Supabase 项目配置

1. 在 [Supabase](https://supabase.com) 创建项目，记下 **Project URL** 和 **anon public** key。

2. 执行数据库迁移：  
   在 Supabase Dashboard → SQL Editor 中依次执行：
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`

3. 认证方式：  
   - 使用 Supabase Auth 时，用户注册/创建需将邮箱设为 `用户名@warehouse.local`，并同时在 `profiles` 表插入对应用户档案（id = auth.users.id）。  
   - 可在 Dashboard → Authentication → Users 中手动创建用户，或通过 Edge Function / 自建注册接口创建。

4. 存储：在 Storage 中创建 bucket（如 `tool-photos`），配置为公开或使用 signed URL。

## 构建与生产部署

1. 构建：

   ```bash
   npm run build
   ```

   产物在 `dist/`。

2. 部署到静态托管（Vercel / Netlify / Cloudflare Pages 等）：
   - 将构建命令设为 `npm run build`，发布目录设为 `dist`。
   - 在平台中配置与 `.env` 相同的环境变量（如 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`）。

3. 中新两地访问：部署到任意支持全球访问的静态托管即可，数据在 Supabase 云端，无地域限制。

## 备份与回收站

- **数据备份**：Supabase 项目自带每日备份（取决于方案）；也可通过 pg_dump 或 Supabase 备份功能定期导出。
- **回收站**：工具软删除（`deleted_at`）后，可由定时任务在 30 天后物理删除或归档。
