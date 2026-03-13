-- ====================================
-- 验证盘点删除功能迁移
-- ====================================

-- 1. 检查 inventory_tasks 表的新字段
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'inventory_tasks'
AND column_name IN ('is_deleted', 'deleted_at')
ORDER BY column_name;

-- 应该返回：
-- deleted_at | timestamp with time zone | YES
-- is_deleted | boolean | YES

-- 2. 检查索引是否创建成功
SELECT 
  indexname, 
  indexdef
FROM pg_indexes
WHERE tablename = 'inventory_tasks'
AND indexname LIKE '%deleted%';

-- 应该返回：
-- idx_inventory_tasks_deleted | CREATE INDEX idx_inventory_tasks_deleted ON inventory_tasks USING btree (is_deleted, deleted_at)

-- 3. 检查 RLS 策略
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'inventory_tasks'
AND (policyname LIKE '%update%' OR policyname LIKE '%delete%');

-- 应该看到更新和删除策略

-- 4. 测试插入一条记录并软删除
-- 注意：这只是测试，实际使用时不需要执行

-- 5. 查看当前所有盘点任务（包括已删除的）
SELECT 
  id,
  name,
  status,
  is_deleted,
  deleted_at,
  created_at
FROM inventory_tasks
ORDER BY created_at DESC
LIMIT 10;
