-- ====================================
-- 为盘点功能添加删除功能
-- ====================================

-- 1. 为 inventory_tasks 添加软删除字段
ALTER TABLE inventory_tasks 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,  -- 删除时间（软删除）
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;  -- 是否已删除

-- 2. 创建索引提升查询性能
CREATE INDEX IF NOT EXISTS idx_inventory_tasks_deleted 
ON inventory_tasks(is_deleted, deleted_at);

-- 3. 添加注释
COMMENT ON COLUMN inventory_tasks.deleted_at IS '软删除时间';
COMMENT ON COLUMN inventory_tasks.is_deleted IS '是否已删除标记';

-- 4. 更新 RLS 策略（允许删除已完成的任务）
-- 注意：需要确保现有策略不会阻止更新操作
DROP POLICY IF EXISTS "Users can update inventory tasks" ON inventory_tasks;
CREATE POLICY "Users can update inventory tasks"
ON inventory_tasks
FOR UPDATE
USING (true)  -- 允许所有认证用户更新
WITH CHECK (true);

-- 5. 添加删除策略
DROP POLICY IF EXISTS "Users can delete inventory tasks" ON inventory_tasks;
CREATE POLICY "Users can delete inventory tasks"
ON inventory_tasks
FOR DELETE
USING (true);  -- 允许所有认证用户删除
