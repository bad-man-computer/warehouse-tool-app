-- ====================================
-- 验证盘点功能迁移是否成功
-- ====================================

-- 1. 检查 inventory_tasks 表的新字段
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'inventory_tasks'
ORDER BY ordinal_position;

-- 2. 检查 inventory_items 表的新字段
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'inventory_items'
ORDER BY ordinal_position;

-- 3. 检查触发器是否存在
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('inventory_tasks', 'inventory_items')
ORDER BY trigger_name;

-- 4. 检查函数是否存在
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND (routine_name LIKE '%inventory%' OR routine_name LIKE '%update_inventory%')
ORDER BY routine_name;

-- 5. 检查索引是否存在
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('inventory_tasks', 'inventory_items')
ORDER BY indexname;

-- 6. 测试创建一个盘点任务（可选）
-- 取消下面的注释来测试
/*
INSERT INTO inventory_tasks (warehouse_id, operator_id, name, status, total_items)
VALUES (
  (SELECT id FROM warehouses LIMIT 1),
  (SELECT id FROM profiles LIMIT 1),
  '测试任务',
  'in_progress',
  0
) RETURNING *;
*/
