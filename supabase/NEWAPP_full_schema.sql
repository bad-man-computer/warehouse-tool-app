-- ============================================================
-- 仓库工具管理系统 - 完整建表 SQL
-- 在 Supabase 项目 NEWAPP 的 SQL Editor 中：粘贴本文件内容，点击 Run 执行
-- ============================================================

-- 1. 枚举类型
CREATE TYPE tool_status_enum AS ENUM (
  'available', 'borrowed', 'returned', 'damaged', 'repairing', 'lost'
);

CREATE TYPE user_role_enum AS ENUM ('admin', 'warehouse_manager', 'user');

-- 2. 仓库表
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  currency TEXT NOT NULL DEFAULT 'CNY',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 用户档案（id 与 Supabase Auth 用户 id 一致时可关联）
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL DEFAULT '',
  role user_role_enum NOT NULL DEFAULT 'user',
  warehouse_ids UUID[] NULL,
  language TEXT NOT NULL DEFAULT 'zh' CHECK (language IN ('zh', 'en')),
  display_name_zh TEXT,
  display_name_en TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. 工具分类（多级）
CREATE TABLE tool_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES tool_categories(id) ON DELETE CASCADE,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  path_zh TEXT,
  path_en TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(warehouse_id, parent_id, name_zh)
);

-- 5. 工具表
CREATE TABLE tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  asset_code TEXT NOT NULL,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES tool_categories(id) ON DELETE RESTRICT,
  location_zh TEXT NOT NULL DEFAULT '',
  location_en TEXT NOT NULL DEFAULT '',
  status tool_status_enum NOT NULL DEFAULT 'available',
  purchase_info TEXT,
  photo_url TEXT,
  qr_code TEXT,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(warehouse_id, asset_code)
);

CREATE INDEX idx_tools_warehouse_status ON tools(warehouse_id, status);
CREATE INDEX idx_tools_asset_code ON tools(warehouse_id, asset_code);
CREATE INDEX idx_tools_deleted ON tools(deleted_at) WHERE deleted_at IS NULL;

-- 6. 借还记录
CREATE TABLE borrow_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES profiles(id),
  borrower_name TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  expected_return_at TIMESTAMPTZ NOT NULL,
  actual_return_at TIMESTAMPTZ,
  return_status TEXT CHECK (return_status IN ('normal', 'damaged')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_borrow_tool ON borrow_records(tool_id);
CREATE INDEX idx_borrow_expected ON borrow_records(expected_return_at) WHERE actual_return_at IS NULL;

-- 7. 维修记录
CREATE TABLE repair_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  description_zh TEXT,
  description_en TEXT,
  photo_urls TEXT[],
  sent_at TIMESTAMPTZ,
  vendor TEXT,
  cost NUMERIC(12,2),
  expected_complete_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result TEXT CHECK (result IN ('repaired', 'scrapped')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_repair_tool ON repair_records(tool_id);

-- 8. 盘点任务
CREATE TABLE inventory_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 9. 盘点明细
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES inventory_tasks(id) ON DELETE CASCADE,
  tool_id UUID REFERENCES tools(id) ON DELETE SET NULL,
  asset_code TEXT NOT NULL,
  expected_status tool_status_enum,
  actual_status tool_status_enum,
  difference_type TEXT CHECK (difference_type IN ('surplus', 'shortage', 'match')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. 操作审计日志
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_created ON audit_logs(created_at);
CREATE INDEX idx_audit_user ON audit_logs(user_id);

-- 11. 种子数据：两个仓库
INSERT INTO warehouses (id, code, name_zh, name_en, timezone, currency) VALUES
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'CN', '中国仓库', 'China Warehouse', 'Asia/Shanghai', 'CNY'),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'SG', '新加坡仓库', 'Singapore Warehouse', 'Asia/Singapore', 'SGD');

-- 12. 触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER warehouses_updated BEFORE UPDATE ON warehouses FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER tools_updated BEFORE UPDATE ON tools FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER borrow_records_updated BEFORE UPDATE ON borrow_records FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER repair_records_updated BEFORE UPDATE ON repair_records FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- 13. 行级安全 (RLS)
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrow_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

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

-- 14. 允许匿名读取仓库（可选，便于登录前选仓库）
CREATE POLICY "warehouses_select_anon" ON warehouses FOR SELECT TO anon USING (true);

-- 执行完毕后可到 Table Editor 查看：warehouses, profiles, tool_categories, tools 等表。
