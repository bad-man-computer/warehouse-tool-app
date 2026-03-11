# 🔧 分类创建 RLS 权限修复指南

## 问题描述

当用户尝试添加工具并选择新分类时，可能会遇到以下错误：
```
new row violates row-level security policy for table "tool_categories"
```

这是因为 Supabase 的**行级安全策略（RLS）**限制了用户对 `tool_categories` 表的写入权限。

---

## 解决方案

### 方案一：在 Supabase Dashboard 中执行 SQL 脚本（推荐）

#### 步骤：

1. **登录 Supabase Dashboard**
   - 访问 https://supabase.com/dashboard
   - 选择您的项目

2. **打开 SQL Editor**
   - 点击左侧菜单 **SQL Editor**
   - 点击 **New query**

3. **复制并执行修复脚本**
   
   复制文件 `supabase/scripts/fix_category_rls.sql` 中的内容，粘贴到 SQL Editor 中，然后点击 **Run**。

4. **验证结果**
   
   执行成功后，您应该能看到类似的输出：
   ```
   schemaname | tablename        | policyname                              | permissive | roles                    | cmd
   -----------|------------------|-----------------------------------------|------------|--------------------------|------
   public     | tool_categories  | Admins can manage categories            | PERMISSIVE | {authenticated}          | ALL
   public     | tool_categories  | Users can view categories               | PERMISSIVE | {authenticated}          | SELECT
   public     | tool_categories  | Warehouse managers can manage their...  | PERMISSIVE | {authenticated}          | ALL
   ```

5. **重新测试**
   
   回到应用，再次尝试添加工具和分类，现在应该可以正常创建了。

---

### 方案二：临时禁用 RLS（仅限测试环境）

⚠️ **注意**：此方法仅建议在开发/测试环境中使用，生产环境请使用方案一。

```sql
-- 临时禁用 RLS（不推荐用于生产环境）
ALTER TABLE tool_categories DISABLE ROW LEVEL SECURITY;
```

---

## 权限说明

修复后的权限策略：

| 角色 | 查看分类 | 创建分类 | 编辑分类 | 删除分类 |
|------|---------|---------|---------|---------|
| **admin** | ✅ | ✅ | ✅ | ✅ |
| **warehouse_manager** | ✅ | ✅ (限自己仓库) | ✅ (限自己仓库) | ✅ (限自己仓库) |
| **user** | ✅ | ❌ | ❌ | ❌ |

---

## 其他修改

本次更新还包括：

### 1. 工具名称填写优化
- ✅ **资产编号**：必填
- ✅ **中文名称**：可选（与英文名称至少填一个）
- ✅ **英文名称**：可选（与中文名称至少填一个）

之前需要同时填写中英文名称，现在只需填写任意一个即可保存。

### 2. 错误提示优化
当分类创建失败时，系统会：
- 记录详细的错误日志到浏览器控制台
- 如果是 RLS 权限问题，显示友好的中文提示
- 其他错误显示原始错误信息

---

## 常见问题

### Q: 执行 SQL 后仍然无法创建分类？
A: 请检查：
1. 您的用户角色是否为 `admin` 或 `warehouse_manager`
2. 如果是 `warehouse_manager`，确认该仓库 ID 在您的 `warehouse_ids` 列表中
3. 刷新页面后重试

### Q: 如何查看当前用户的角色？
A: 在 SQL Editor 中执行：
```sql
SELECT username, role, warehouse_ids 
FROM profiles 
WHERE id = auth.uid();
```

### Q: 我想让所有用户都能创建分类怎么办？
A: 可以修改策略为：
```sql
DROP POLICY IF EXISTS "All users can manage categories" ON tool_categories;
CREATE POLICY "All users can manage categories"
ON tool_categories
FOR ALL
USING (true);
```

---

## 相关文件

- SQL 修复脚本：`supabase/scripts/fix_category_rls.sql`
- 前端代码：`src/pages/ToolList.tsx`
- 分类选择器：`src/components/CategorySelector.tsx`
