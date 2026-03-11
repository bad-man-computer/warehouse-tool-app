# 👥 用户管理指南

## 🚀 快速开始 - 创建第一个管理员

### 方法一：使用 Supabase Dashboard（最简单）

#### 步骤 1：在 Supabase 创建用户
1. 登录 https://supabase.com/dashboard
2. 选择您的项目
3. 点击左侧菜单 **Authentication** → **Users**
4. 点击右上角 **Add user**
5. 填写信息：
   - **Email**: `admin@warehouse.local`
   - **Password**: `admin123` (请修改为强密码)
   - ✅ 勾选 **Auto Confirm User**
6. 点击 **Create user**

#### 步骤 2：获取用户 ID
- 在用户列表中，找到刚创建的用户
- 复制 **User ID**（UUID 格式，类似：`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`）

#### 步骤 3：运行 SQL 脚本赋予管理员权限
1. 点击左侧菜单 **SQL Editor**
2. 点击 **New query**
3. 复制以下 SQL（替换 YOUR_USER_ID）：

```sql
-- 将用户设置为管理员
UPDATE profiles 
SET role = 'admin',
   warehouse_ids = (SELECT ARRAY[SELECT id FROM warehouses LIMIT 1])::UUID[]
WHERE id = 'YOUR_USER_ID_HERE';  -- 替换这里的 UUID

-- 查看结果
SELECT username, role, warehouse_ids FROM profiles WHERE id = 'YOUR_USER_ID_HERE';
```

4. 将 `YOUR_USER_ID_HERE` 替换为您的实际用户 ID
5. 点击 **Run** 执行

---

### 方法二：直接插入完整用户档案

如果您想一步到位创建完整的管理员账户：

```sql
-- 注意：请先在 Authentication -> Users 中创建用户，然后替换下面的 ID

INSERT INTO profiles (id, username, password_hash, role, warehouse_ids, language, display_name_zh, display_name_en)
VALUES (
  'YOUR_USER_ID_HERE',  -- 替换为从 Authentication 页面复制的用户 ID
  'admin',
  '',  -- 密码由 Supabase Auth 管理
  'admin',  -- 管理员角色
  (SELECT ARRAY[SELECT id FROM warehouses LIMIT 1])::UUID[],  -- 自动关联第一个仓库
  'zh',
  '系统管理员',
  'System Admin'
)
ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  updated_at = now();
```

---

## 🔧 常用用户管理命令

### 查看所有用户及其权限
```sql
SELECT 
  p.username,
  p.role,
  CASE 
    WHEN p.warehouse_ids IS NULL THEN '所有仓库'
    ELSE string_agg(w.name_zh, ', ')
  END as warehouses,
  p.display_name_zh
FROM profiles p
LEFT JOIN LATERAL unnest(p.warehouse_ids) AS wid ON true
LEFT JOIN warehouses w ON w.id = wid
GROUP BY p.id, p.username, p.role, p.warehouse_ids, p.language, p.display_name_zh
ORDER BY p.username;
```

### 修改用户角色
```sql
-- 升级为管理员
UPDATE profiles SET role = 'admin' WHERE username = '用户名';

-- 降级为普通用户
UPDATE profiles SET role = 'user' WHERE username = '用户名';

-- 设置为仓库管理员
UPDATE profiles SET role = 'warehouse_manager' WHERE username = '用户名';
```

### 为用户添加仓库权限
```sql
-- 添加单个仓库
UPDATE profiles 
SET warehouse_ids = array_append(warehouse_ids, '仓库-ID') 
WHERE username = '用户名';

-- 设置多个仓库
UPDATE profiles 
SET warehouse_ids = ARRAY['仓库-ID-1', '仓库-ID-2']::UUID[] 
WHERE username = '用户名';
```

### 删除用户
```sql
-- 删除用户档案（保留认证信息）
DELETE FROM profiles WHERE username = '用户名';

-- 完全删除用户（包括认证信息）
-- 需要在 Authentication -> Users 中手动删除
```

---

## 📋 用户角色说明

| 角色 | 权限 | 适用场景 |
|------|------|----------|
| **admin** | 所有权限：可以添加/编辑/删除工具、管理用户、查看所有数据 | 系统管理员 |
| **warehouse_manager** | 仓库管理权限：可以添加/编辑/删除工具、管理库存 | 仓库管理员 |
| **user** | 基础权限：只能借用/归还工具、查看工具列表 | 普通员工 |

---

## 🎯 演示模式

如果未配置 Supabase（没有环境变量），可以使用演示账号：
- **用户名**: `demo`
- **密码**: `demo`
- **角色**: `admin`（自动拥有所有权限）

⚠️ **注意**: 演示模式仅用于测试，生产环境必须配置 Supabase。

---

## 🔐 环境变量配置

在 Vercel 或本地 `.env` 文件中配置：

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## ❓ 常见问题

### Q: 登录后看不到工具列表？
A: 检查用户的 `warehouse_ids` 是否包含有效的仓库 ID。

### Q: 如何创建多个管理员？
A: 重复上述步骤，为每个用户在 Supabase Auth 中创建账户，然后在 profiles 表中设置 `role='admin'`。

### Q: 忘记密码怎么办？
A: 在 Supabase Dashboard → Authentication → Users 中找到用户，点击菜单选择 "Reset password"。

### Q: 用户无法访问某个仓库？
A: 确保该仓库 ID 已添加到用户的 `warehouse_ids` 数组中。

---

## 📞 需要帮助？

如果遇到其他问题，请检查：
1. Supabase 项目配置是否正确
2. 环境变量是否已设置
3. 用户角色和仓库权限是否正确配置
