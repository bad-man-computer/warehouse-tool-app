-- ============================================================
-- 若要把所有表建在 schema "NEWAPP" 下（而非默认 public），使用本文件
-- 在 Supabase SQL Editor 中执行
-- ============================================================

CREATE SCHEMA IF NOT EXISTS "NEWAPP";

-- 枚举（在 public 下，全库共用；若要在 NEWAPP 下需用 NEWAPP.tool_status_enum 等）
CREATE TYPE tool_status_enum AS ENUM (
  'available', 'borrowed', 'returned', 'damaged', 'repairing', 'lost'
);
CREATE TYPE user_role_enum AS ENUM ('admin', 'warehouse_manager', 'user');

-- 表都建在 NEWAPP 下
CREATE TABLE "NEWAPP".warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  currency TEXT NOT NULL DEFAULT 'CNY',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE "NEWAPP".profiles (
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

CREATE TABLE "NEWAPP".tool_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES "NEWAPP".warehouses(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES "NEWAPP".tool_categories(id) ON DELETE CASCADE,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  path_zh TEXT,
  path_en TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(warehouse_id, parent_id, name_zh)
);

CREATE TABLE "NEWAPP".tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES "NEWAPP".warehouses(id) ON DELETE CASCADE,
  asset_code TEXT NOT NULL,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES "NEWAPP".tool_categories(id) ON DELETE RESTRICT,
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

CREATE INDEX idx_tools_warehouse_status ON "NEWAPP".tools(warehouse_id, status);
CREATE INDEX idx_tools_asset_code ON "NEWAPP".tools(warehouse_id, asset_code);
CREATE INDEX idx_tools_deleted ON "NEWAPP".tools(deleted_at) WHERE deleted_at IS NULL;

CREATE TABLE "NEWAPP".borrow_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES "NEWAPP".tools(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES "NEWAPP".profiles(id),
  borrower_name TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  expected_return_at TIMESTAMPTZ NOT NULL,
  actual_return_at TIMESTAMPTZ,
  return_status TEXT CHECK (return_status IN ('normal', 'damaged')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_borrow_tool ON "NEWAPP".borrow_records(tool_id);
CREATE INDEX idx_borrow_expected ON "NEWAPP".borrow_records(expected_return_at) WHERE actual_return_at IS NULL;

CREATE TABLE "NEWAPP".repair_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES "NEWAPP".tools(id) ON DELETE CASCADE,
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

CREATE INDEX idx_repair_tool ON "NEWAPP".repair_records(tool_id);

CREATE TABLE "NEWAPP".inventory_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES "NEWAPP".warehouses(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES "NEWAPP".profiles(id),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE "NEWAPP".inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES "NEWAPP".inventory_tasks(id) ON DELETE CASCADE,
  tool_id UUID REFERENCES "NEWAPP".tools(id) ON DELETE SET NULL,
  asset_code TEXT NOT NULL,
  expected_status tool_status_enum,
  actual_status tool_status_enum,
  difference_type TEXT CHECK (difference_type IN ('surplus', 'shortage', 'match')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE "NEWAPP".audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES "NEWAPP".profiles(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_created ON "NEWAPP".audit_logs(created_at);
CREATE INDEX idx_audit_user ON "NEWAPP".audit_logs(user_id);

INSERT INTO "NEWAPP".warehouses (id, code, name_zh, name_en, timezone, currency) VALUES
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'CN', '中国仓库', 'China Warehouse', 'Asia/Shanghai', 'CNY'),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'SG', '新加坡仓库', 'Singapore Warehouse', 'Asia/Singapore', 'SGD');

CREATE OR REPLACE FUNCTION "NEWAPP".set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER warehouses_updated BEFORE UPDATE ON "NEWAPP".warehouses FOR EACH ROW EXECUTE PROCEDURE "NEWAPP".set_updated_at();
CREATE TRIGGER tools_updated BEFORE UPDATE ON "NEWAPP".tools FOR EACH ROW EXECUTE PROCEDURE "NEWAPP".set_updated_at();
CREATE TRIGGER borrow_records_updated BEFORE UPDATE ON "NEWAPP".borrow_records FOR EACH ROW EXECUTE PROCEDURE "NEWAPP".set_updated_at();
CREATE TRIGGER repair_records_updated BEFORE UPDATE ON "NEWAPP".repair_records FOR EACH ROW EXECUTE PROCEDURE "NEWAPP".set_updated_at();
CREATE TRIGGER profiles_updated BEFORE UPDATE ON "NEWAPP".profiles FOR EACH ROW EXECUTE PROCEDURE "NEWAPP".set_updated_at();

ALTER TABLE "NEWAPP".warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NEWAPP".profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NEWAPP".tool_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NEWAPP".tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NEWAPP".borrow_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NEWAPP".repair_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NEWAPP".inventory_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NEWAPP".inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NEWAPP".audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warehouses_select" ON "NEWAPP".warehouses FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_select_own" ON "NEWAPP".profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "tool_categories_select" ON "NEWAPP".tool_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "tools_select" ON "NEWAPP".tools FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "tools_all" ON "NEWAPP".tools FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "borrow_records_all" ON "NEWAPP".borrow_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "repair_records_all" ON "NEWAPP".repair_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "inventory_tasks_all" ON "NEWAPP".inventory_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "inventory_items_all" ON "NEWAPP".inventory_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "audit_logs_insert" ON "NEWAPP".audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "audit_logs_select" ON "NEWAPP".audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "warehouses_select_anon" ON "NEWAPP".warehouses FOR SELECT TO anon USING (true);
