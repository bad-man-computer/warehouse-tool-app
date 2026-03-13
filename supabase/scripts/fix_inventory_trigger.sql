-- ====================================
-- 修复盘点触发器错误
-- ====================================

-- 问题：update_inventory_task_stats() 函数中引用了不存在的 NEW.status 字段
-- 解决：移除对 status 的引用，因为 inventory_items 表没有 status 字段

-- 1. 重新创建正确的触发器函数
CREATE OR REPLACE FUNCTION update_inventory_task_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- 更新任务的统计数据
  UPDATE inventory_tasks
  SET 
    scanned_items = (
      SELECT COUNT(*) FROM inventory_items 
      WHERE task_id = NEW.task_id AND actual_status IS NOT NULL
    ),
    match_count = (
      SELECT COUNT(*) FROM inventory_items 
      WHERE task_id = NEW.task_id AND difference_type = 'match'
    ),
    surplus_count = (
      SELECT COUNT(*) FROM inventory_items 
      WHERE task_id = NEW.task_id AND difference_type = 'surplus'
    ),
    shortage_count = (
      SELECT COUNT(*) FROM inventory_items 
      WHERE task_id = NEW.task_id AND difference_type = 'shortage'
    )
    -- 注意：移除了 completed_at 的更新逻辑
    -- 因为 inventory_items 表没有 status 字段
    -- 任务完成状态应该在更新 inventory_tasks 时手动设置
  WHERE id = NEW.task_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 验证函数是否创建成功
SELECT 
  proname as function_name,
  prosrc as source
FROM pg_proc 
WHERE proname = 'update_inventory_task_stats';

-- 执行成功后，应该看到类似输出：
-- function_name: update_inventory_task_stats
-- source: (函数源码)
