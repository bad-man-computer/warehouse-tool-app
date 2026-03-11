# API 接口文档

## 说明

- 后端采用 **Supabase**：认证、数据库、存储、实时 API 均由 Supabase 提供。
- 前端通过 `@supabase/supabase-js` 调用 Supabase 的 REST/Realtime API；认证使用 Supabase Auth（登录邮箱约定为 `用户名@warehouse.local`）。

## 认证

### 登录（Supabase Auth）

- **接口**：`supabase.auth.signInWithPassword({ email, password })`
- **约定**：`email = ${username}@warehouse.local`，password 为用户密码。
- **返回**：session 含 `access_token`（JWT），前端持久化后请求时在 Header 中携带。

### 登出

- **接口**：`supabase.auth.signOut()`

### 获取当前用户

- **接口**：`supabase.auth.getUser()`

## 用户档案

- **表名**：`profiles`
- **查询当前用户档案**：`supabase.from('profiles').select('*').eq('id', authUserId).single()`
- **更新语言**：`supabase.from('profiles').update({ language }).eq('id', authUserId)`

## 仓库

- **表名**：`warehouses`
- **列表**：`supabase.from('warehouses').select('*').order('code')`

## 工具分类

- **表名**：`tool_categories`
- **按仓库查询**：`supabase.from('tool_categories').select('*').eq('warehouse_id', warehouseId)`
- **树形**：需在应用层按 `parent_id` 组树。

## 工具

- **表名**：`tools`
- **列表**：  
  `supabase.from('tools').select('*').eq('warehouse_id', id).is('deleted_at', null)`  
  可链式 `.eq('status', status)`、`.or('asset_code.ilike.%x%,name_zh.ilike.%x%')` 等。
- **单条**：`.select('*').eq('id', toolId).single()`
- **新增**：`.insert({ warehouse_id, asset_code, name_zh, name_en, category_id, location_zh, location_en, status, ... })`
- **更新**：`.update({ status, ... }).eq('id', toolId)`（借还、报损、送修等会更新 status）
- **软删除**：`.update({ deleted_at: new Date().toISOString() }).eq('id', toolId)`

## 借还记录

- **表名**：`borrow_records`
- **新增借出**：`insert({ tool_id, operator_id, borrower_name, department, contact, expected_return_at })`，并更新 `tools.status = 'borrowed'`。
- **归还**：更新对应 `borrow_record` 的 `actual_return_at`、`return_status`，并更新 `tools.status = 'returned'`；检查通过后再将工具改为 `available`。

## 维修记录

- **表名**：`repair_records`
- **报损**：`insert` 一条记录，工具 `status` 改为 `damaged`。
- **送修**：`update` 该记录的 `sent_at, vendor, expected_complete_at`，工具 `status` 改为 `repairing`。
- **完成**：`update` 记录的 `completed_at, result`，工具 `status` 改为 `available` 或核销/`lost`。

## 盘点

- **表名**：`inventory_tasks`、`inventory_items`
- **发起**：`insert` 一条 `inventory_tasks`，再按仓库工具列表生成或扫码逐条写入 `inventory_items`。
- **完成**：更新 `inventory_tasks.status = 'completed'`、`completed_at`。

## 审计日志

- **表名**：`audit_logs`
- **写入**：应用层在增删改时 `insert({ user_id, action, table_name, record_id, old_data, new_data, ip_address })`。

## 存储（Supabase Storage）

- 工具照片、损坏照片：上传到 Supabase Storage Bucket，将返回的 public URL 写入 `tools.photo_url` 或 `repair_records.photo_urls`。

## 实时订阅（可选）

- 工具列表实时更新：  
  `supabase.channel('tools').on('postgres_changes', { event: '*', schema: 'public', table: 'tools', filter: `warehouse_id=eq.${id}` }, callback).subscribe()`
