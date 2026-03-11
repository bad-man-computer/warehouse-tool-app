import type { ToolStatus } from '@/types'

export const TOOL_STATUS: Record<ToolStatus, { labelKey: string; color: string }> = {
  available: { labelKey: 'toolStatus.available', color: 'bg-green-100 text-green-800' },
  borrowed: { labelKey: 'toolStatus.borrowed', color: 'bg-blue-100 text-blue-800' },
  returned: { labelKey: 'toolStatus.returned', color: 'bg-amber-100 text-amber-800' },
  damaged: { labelKey: 'toolStatus.damaged', color: 'bg-red-100 text-red-800' },
  repairing: { labelKey: 'toolStatus.repairing', color: 'bg-orange-100 text-orange-800' },
  lost: { labelKey: 'toolStatus.lost', color: 'bg-gray-100 text-gray-800' },
}

// 状态流转：from -> [to]
export const TOOL_STATUS_TRANSITIONS: Partial<Record<ToolStatus, ToolStatus[]>> = {
  available: ['borrowed', 'damaged', 'lost'],
  borrowed: ['returned', 'damaged', 'lost'],
  returned: ['available'],
  damaged: ['repairing'],
  repairing: ['available', 'lost'],
}

/**
 * 校验工具状态是否允许从 from 流转到 to
 * @param from 当前状态
 * @param to 目标状态
 */
export function canTransition(from: ToolStatus, to: ToolStatus): boolean {
  const allowed = TOOL_STATUS_TRANSITIONS[from]
  return Array.isArray(allowed) && allowed.includes(to)
}
