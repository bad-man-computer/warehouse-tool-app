// 工具状态：需求文档规定的 6 种状态
export type ToolStatus =
  | 'available'   // 可用
  | 'borrowed'    // 借出
  | 'returned'    // 已归还
  | 'damaged'     // 损坏
  | 'repairing'   // 维修中
  | 'lost'        // 遗失

export type UserRole = 'admin' | 'warehouse_manager' | 'user'

export interface Warehouse {
  id: string
  code: string
  name_zh: string
  name_en: string
  timezone: string
  currency: string
}

export interface UserProfile {
  id: string
  username: string
  role: UserRole
  warehouse_ids: string[] | null  // 仓库经理管辖的仓库；null 表示全部
  language: 'zh' | 'en'
  display_name_zh?: string
  display_name_en?: string
}

export interface ToolCategory {
  id: string
  warehouse_id: string
  parent_id: string | null
  name_zh: string
  name_en: string
  path_zh?: string
  path_en?: string
}

export interface Tool {
  id: string
  warehouse_id: string
  asset_code: string
  name_zh: string
  name_en: string
  category_id: string
  location_zh: string
  location_en: string
  status: ToolStatus
  purchase_info?: string
  photo_url?: string
  qr_code?: string
  qr_code_image?: string
  model?: string
  quantity?: number
  remarks?: string
  purchase_date?: string
  created_at: string
  updated_at: string
}

export interface BorrowRecord {
  id: string
  tool_id: string
  operator_id?: string | null
  borrower_name: string
  department: string
  contact: string
  expected_return_at: string
  actual_return_at: string | null
  return_status: 'normal' | 'damaged' | null
  created_at: string
  updated_at?: string
  tool?: Tool
}

export type DifferenceType = 'surplus' | 'shortage' | 'match' | 'status_mismatch'

export interface InventoryTask {
  id: string
  warehouse_id: string
  operator_id?: string | null
  name?: string | null  // 任务名称
  description_zh?: string | null  // 中文描述
  description_en?: string | null  // 英文描述
  status: 'in_progress' | 'completed'
  scheduled_at?: string | null  // 计划完成时间
  total_items: number  // 应盘总数
  scanned_items: number  // 已盘数量
  match_count: number  // 相符数量
  surplus_count: number  // 盘盈数量
  shortage_count: number  // 盘亏数量
  created_at: string
  completed_at?: string | null
  is_deleted?: boolean  // 是否已删除
  deleted_at?: string | null  // 删除时间
}

export interface InventoryItem {
  id: string
  task_id: string
  tool_id: string | null
  asset_code: string
  expected_status: ToolStatus | null
  actual_status: ToolStatus | null
  difference_type: DifferenceType | null
  notes?: string | null
  operator_id?: string | null  // 盘点人
  actual_quantity?: number | null  // 实际数量
  expected_quantity?: number | null  // 预期数量
  created_at: string
  updated_at?: string | null
}

export interface RepairRecord {
  id: string
  tool_id: string
  reported_at: string
  description_zh?: string | null
  description_en?: string | null
  photo_urls?: string[] | null
  sent_at?: string | null
  vendor?: string | null
  cost?: number | null
  expected_complete_at?: string | null
  completed_at?: string | null
  result: 'repaired' | 'scrapped' | null
  created_at?: string
  updated_at?: string
  tool?: Tool
}
