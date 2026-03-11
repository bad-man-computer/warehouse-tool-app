-- 允许盘点差异类型增加 status_mismatch（状态不符）
ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS inventory_items_difference_type_check;
ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_difference_type_check
  CHECK (difference_type IN ('surplus', 'shortage', 'match', 'status_mismatch'));
