-- ====================================
-- 增强盘点功能 - 添加必要字段
-- ====================================

-- 1. 为 inventory_tasks 添加更多字段
ALTER TABLE inventory_tasks 
ADD COLUMN IF NOT EXISTS name TEXT,  -- 盘点任务名称
ADD COLUMN IF NOT EXISTS description_zh TEXT,  -- 中文描述
ADD COLUMN IF NOT EXISTS description_en TEXT,  -- 英文描述
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,  -- 计划完成时间
ADD COLUMN IF NOT EXISTS total_items INTEGER DEFAULT 0,  -- 应盘总数
ADD COLUMN IF NOT EXISTS scanned_items INTEGER DEFAULT 0,  -- 已盘数量
ADD COLUMN IF NOT EXISTS match_count INTEGER DEFAULT 0,  -- 相符数量
ADD COLUMN IF NOT EXISTS surplus_count INTEGER DEFAULT 0,  -- 盘盈数量
ADD COLUMN IF NOT EXISTS shortage_count INTEGER DEFAULT 0;  -- 盘亏数量

-- 2. 为 inventory_items 添加操作员和备注字段
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS operator_id UUID REFERENCES profiles(id),  -- 盘点人
ADD COLUMN IF NOT EXISTS actual_quantity INTEGER DEFAULT 1,  -- 实际数量（未来扩展）
ADD COLUMN IF NOT EXISTS expected_quantity INTEGER DEFAULT 1,  -- 预期数量
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. 创建触发器自动更新 updated_at
CREATE OR REPLACE FUNCTION update_inventory_item_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_inventory_item_updated_at
BEFORE UPDATE ON inventory_items
FOR EACH ROW
EXECUTE FUNCTION update_inventory_item_updated_at();

-- 4. 为 inventory_tasks 创建统计更新函数
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
    ),
    completed_at = CASE 
      WHEN NEW.status = 'completed' THEN now()
      ELSE completed_at
    END
  WHERE id = NEW.task_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建触发器
CREATE TRIGGER trg_update_inventory_stats
AFTER INSERT OR UPDATE ON inventory_items
FOR EACH ROW
EXECUTE FUNCTION update_inventory_task_stats();

-- 6. 添加索引提升查询性能
CREATE INDEX IF NOT EXISTS idx_inventory_items_task_tool 
ON inventory_items(task_id, tool_id);

CREATE INDEX IF NOT EXISTS idx_inventory_items_operator 
ON inventory_items(operator_id);

CREATE INDEX IF NOT EXISTS idx_inventory_tasks_warehouse_status 
ON inventory_tasks(warehouse_id, status);

-- 7. 添加注释
COMMENT ON COLUMN inventory_tasks.name IS '盘点任务名称';
COMMENT ON COLUMN inventory_tasks.description_zh IS '中文描述';
COMMENT ON COLUMN inventory_tasks.description_en IS '英文描述';
COMMENT ON COLUMN inventory_tasks.total_items IS '应盘工具总数';
COMMENT ON COLUMN inventory_tasks.scanned_items IS '已扫描数量';
COMMENT ON COLUMN inventory_tasks.match_count IS '相符数量';
COMMENT ON COLUMN inventory_tasks.surplus_count IS '盘盈数量';
COMMENT ON COLUMN inventory_tasks.shortage_count IS '盘亏数量';
COMMENT ON COLUMN inventory_items.operator_id IS '盘点操作人 ID';
COMMENT ON COLUMN inventory_items.actual_quantity IS '实际数量';
COMMENT ON COLUMN inventory_items.expected_quantity IS '预期数量';
