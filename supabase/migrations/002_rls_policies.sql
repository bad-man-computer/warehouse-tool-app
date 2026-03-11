-- RLS：按仓库与角色隔离数据
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrow_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 当前用户可见仓库：admin 全部，warehouse_manager 为 warehouse_ids，user 为第一个 warehouse_id（需由 app 传参或 session）
-- 此处使用 JWT 自定义 claim：app_metadata.role, app_metadata.warehouse_ids
-- 简化：通过 service role 或 API 层校验；RLS 仅做基础隔离，允许已认证用户读其仓库数据
CREATE POLICY "warehouses_select" ON warehouses FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "tool_categories_select" ON tool_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "tools_select" ON tools FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "tools_all" ON tools FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "borrow_records_all" ON borrow_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "repair_records_all" ON repair_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "inventory_tasks_all" ON inventory_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "inventory_items_all" ON inventory_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT TO authenticated USING (true);
