# 数据库结构文档

## 概述

- 数据库：PostgreSQL（Supabase 云端）
- 迁移文件：`supabase/migrations/001_initial_schema.sql`、`002_rls_policies.sql`

## 枚举类型

### tool_status_enum

| 值 | 说明 |
|----|------|
| available | 可用 |
| borrowed | 借出 |
| returned | 已归还 |
| damaged | 损坏 |
| repairing | 维修中 |
| lost | 遗失 |

### user_role_enum

| 值 | 说明 |
|----|------|
| admin | 管理员 |
| warehouse_manager | 仓库经理 |
| user | 普通用户 |

## 表结构

### warehouses 仓库

| 列名 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| code | TEXT UNIQUE | 代码（CN/SG） |
| name_zh | TEXT | 中文名称 |
| name_en | TEXT | 英文名称 |
| timezone | TEXT | 时区 |
| currency | TEXT | 货币 |
| created_at, updated_at | TIMESTAMPTZ | 时间戳 |

### profiles 用户档案

| 列名 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 与 Supabase Auth 用户 id 一致 |
| username | TEXT UNIQUE | 登录用户名 |
| password_hash | TEXT | BCrypt 哈希（若使用自定义认证） |
| role | user_role_enum | 角色 |
| warehouse_ids | UUID[] | 仓库经理管辖仓库 ID 列表，NULL 表示管理员全部 |
| language | TEXT | zh / en |
| display_name_zh, display_name_en | TEXT | 显示名 |
| created_at, updated_at | TIMESTAMPTZ | 时间戳 |

### tool_categories 工具分类（多级）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| warehouse_id | UUID FK | 所属仓库 |
| parent_id | UUID FK | 父分类，NULL 为顶级 |
| name_zh, name_en | TEXT | 中英文名称 |
| path_zh, path_en | TEXT | 层级路径（可选） |
| created_at | TIMESTAMPTZ | 时间戳 |

### tools 工具

| 列名 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| warehouse_id | UUID FK | 所属仓库 |
| asset_code | TEXT | 资产编号（同仓库内唯一） |
| name_zh, name_en | TEXT | 中英文名称 |
| category_id | UUID FK | 分类 |
| location_zh, location_en | TEXT | 存放位置 |
| status | tool_status_enum | 状态 |
| purchase_info | TEXT | 购买信息 |
| photo_url | TEXT | 照片 URL |
| qr_code | TEXT | 二维码内容或 URL |
| deleted_at | TIMESTAMPTZ | 软删除时间，NULL 表示未删除 |
| created_at, updated_at | TIMESTAMPTZ | 时间戳 |

唯一约束：`(warehouse_id, asset_code)`  
索引：`(warehouse_id, status)`、`(warehouse_id, asset_code)`、`deleted_at`（部分索引，仅未删除）

### borrow_records 借还记录

| 列名 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| tool_id | UUID FK | 工具 |
| operator_id | UUID FK | 操作人 |
| borrower_name | TEXT | 借用人姓名 |
| department | TEXT | 部门 |
| contact | TEXT | 联系方式 |
| expected_return_at | TIMESTAMPTZ | 预计归还时间 |
| actual_return_at | TIMESTAMPTZ | 实际归还时间 |
| return_status | TEXT | normal / damaged |
| created_at, updated_at | TIMESTAMPTZ | 时间戳 |

### repair_records 维修记录

| 列名 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| tool_id | UUID FK | 工具 |
| reported_at | TIMESTAMPTZ | 报损时间 |
| description_zh, description_en | TEXT | 问题描述 |
| photo_urls | TEXT[] | 损坏照片 |
| sent_at | TIMESTAMPTZ | 送修时间 |
| vendor | TEXT | 维修商 |
| cost | NUMERIC(12,2) | 费用 |
| expected_complete_at | TIMESTAMPTZ | 预计完成 |
| completed_at | TIMESTAMPTZ | 实际完成 |
| result | TEXT | repaired / scrapped |
| created_at, updated_at | TIMESTAMPTZ | 时间戳 |

### inventory_tasks 盘点任务

| 列名 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| warehouse_id | UUID FK | 仓库 |
| operator_id | UUID FK | 操作人 |
| status | TEXT | in_progress / completed |
| created_at, completed_at | TIMESTAMPTZ | 时间戳 |

### inventory_items 盘点明细

| 列名 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| task_id | UUID FK | 盘点任务 |
| tool_id | UUID FK | 工具（可为 NULL 盘盈） |
| asset_code | TEXT | 资产编号 |
| expected_status | tool_status_enum | 预期状态 |
| actual_status | tool_status_enum | 实际状态 |
| difference_type | TEXT | surplus / shortage / match |
| notes | TEXT | 备注 |
| created_at | TIMESTAMPTZ | 时间戳 |

### audit_logs 操作审计

| 列名 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| user_id | UUID FK | 操作人 |
| action | TEXT | 操作类型 |
| table_name | TEXT | 表名 |
| record_id | UUID | 记录 ID |
| old_data, new_data | JSONB | 变更前后数据 |
| ip_address | INET | IP |
| created_at | TIMESTAMPTZ | 时间戳 |

## 状态流转规则（工具）

- available → borrowed（借出）
- borrowed → returned（归还）
- borrowed / available → damaged（报损）
- damaged → repairing（送修）
- repairing → available（修好）或 lost（报废/核销）
- borrowed / available / repairing → lost（报失）
- returned → available（重新入库通过）

## RLS（行级安全）

- 所有表已启用 RLS；策略为 `authenticated` 用户可读/写（具体按角色与 warehouse_ids 的过滤在应用层或更细的 RLS 策略中实现）。
