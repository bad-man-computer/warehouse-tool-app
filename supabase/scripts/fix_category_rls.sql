-- ====================================
-- 修复工具分类表的行级安全策略（RLS）
-- 允许管理员和仓库经理创建/编辑分类
-- ====================================

-- 启用 RLS
ALTER TABLE tool_categories ENABLE ROW LEVEL SECURITY;

-- 删除旧的策略（如果存在）
DROP POLICY IF EXISTS "Users can view categories from their warehouse" ON tool_categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON tool_categories;
DROP POLICY IF EXISTS "Warehouse managers can manage categories" ON tool_categories;

-- 创建新的策略：允许所有认证用户查看分类
CREATE POLICY "Users can view categories"
ON tool_categories
FOR SELECT
USING (true);

-- 允许管理员创建/编辑/删除分类
CREATE POLICY "Admins can manage categories"
ON tool_categories
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- 允许仓库经理创建/编辑/删除自己仓库的分类
CREATE POLICY "Warehouse managers can manage their categories"
ON tool_categories
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (
      profiles.role = 'warehouse_manager'
      OR profiles.role = 'admin'
    )
    AND (
      profiles.warehouse_ids IS NULL
      OR tool_categories.warehouse_id = ANY(profiles.warehouse_ids)
    )
  )
);

-- 验证策略已创建
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'tool_categories'
ORDER BY policyname;
