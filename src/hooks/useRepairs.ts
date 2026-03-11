import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { RepairRecord, Tool } from '@/types'

export interface RepairRecordWithTool extends Omit<RepairRecord, 'tool'> {
  tool: Tool | null
}

type RepairTab = 'repairing' | 'damaged' | 'completed'

/**
 * 维修记录列表：按 tab 筛选（维修中/待维修 damaged/已完成）
 * 通过 tools.status 与 repair 的 result 联合判断
 */
export function useRepairs(warehouseId: string | null, tab: RepairTab) {
  const [records, setRecords] = useState<RepairRecordWithTool[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(() => {
    if (!warehouseId) {
      setRecords([])
      setLoading(false)
      return
    }
    setLoading(true)
  const fetchRecords = async () => {
      try {
     const { data, error } = await supabase!
          .from('repair_records')
          .select(`
            id,
            tool_id,
            reported_at,
            description_zh,
            description_en,
            sent_at,
            vendor,
            cost,
            expected_complete_at,
            completed_at,
            result,
            tool:tools(
              id,
              warehouse_id,
              asset_code,
              name_zh,
              name_en,
              status
            )
          `)
        if (error) {
          console.error('Failed to fetch repair records:', error)
          setRecords([])
          return
        }
        
        // 处理数据，确保 tool 对象正确映射
        let list = ((data as any[]) ?? [])
          .map((r) => ({
            ...r,
            tool: r.tool || null,
          })) as RepairRecordWithTool[]
        
        // 按仓库 ID 筛选
        list = list.filter((r) => r.tool?.warehouse_id === warehouseId)
        
        // 按 tab 筛选
        if (tab === 'repairing') {
          list = list.filter((r) => r.tool?.status === 'repairing' && !r.result)
        } else if (tab === 'damaged') {
          list = list.filter((r) => r.tool?.status === 'damaged')
        } else if (tab === 'completed') {
          list = list.filter((r) => r.result != null)
        }
        
        // 排序
        list.sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime())
        setRecords(list)
      } catch (err) {
        console.error('Error fetching repair records:', err)
        setRecords([])
      } finally {
        setLoading(false)
      }
    }
    fetchRecords()
  }, [warehouseId, tab])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { records, loading, refetch: fetch }
}

/**
 * 单个工具的所有维修历史
 */
export function useRepairHistory(toolId: string | null) {
  const [records, setRecords] = useState<RepairRecord[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!toolId || !supabase) {
      setRecords([])
      return
    }
    setLoading(true)
  const fetchHistory = async () => {
      try {
      const { data } = await supabase!
          .from('repair_records')
          .select('*')
          .eq('tool_id', toolId)
          .order('reported_at', { ascending: false })
        setRecords((data as RepairRecord[]) ?? [])
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [toolId])

  return { records, loading }
}
