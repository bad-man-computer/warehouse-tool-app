import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { BorrowRecord, Tool } from '@/types'

export interface BorrowRecordWithTool extends Omit<BorrowRecord, 'tool'> {
  tool: Tool | null
}

/**
 * 当前仓库的借还记录（可只查未归还）
 */
export function useBorrowRecords(warehouseId: string | null, onlyOpen = true) {
  const [records, setRecords] = useState<BorrowRecordWithTool[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!warehouseId) {
      setRecords([])
      setLoading(false)
      return
    }
    setLoading(true)
    if (!isSupabaseConfigured() || !supabase) {
      setRecords([])
      setLoading(false)
      return
    }
    try {
      const { data: toolRows } = await supabase.from('tools').select('id').eq('warehouse_id', warehouseId)
      const toolIds = (toolRows ?? []).map((t) => t.id)
      if (toolIds.length === 0) {
        setRecords([])
        setLoading(false)
        return
      }
      const { data, error } = await supabase
        .from('borrow_records')
        .select('*, tool:tools(*)')
        .in('tool_id', toolIds)
        .order('created_at', { ascending: false })
      
      if (error) {
        setRecords([])
        return
      }
      
      let list = (data ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        tool: Array.isArray(r.tool) ? r.tool[0] : r.tool,
      })) as BorrowRecordWithTool[]
      if (onlyOpen) list = list.filter((r) => !r.actual_return_at)
      setRecords(list)
    } finally {
      setLoading(false)
    }
  }, [warehouseId, onlyOpen])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { records, loading, refetch: fetch }
}

/**
 * 根据 tool_id 查询该工具当前未归还的借出记录
 */
export function useOpenBorrowByToolId(toolId: string | null) {
  const [record, setRecord] = useState<BorrowRecord | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!toolId || !supabase) {
      setRecord(null)
      return
    }
    
    const fetchRecord = async () => {
      try {
        const { data } = await supabase!
          .from('borrow_records')
          .select('*')
          .eq('tool_id', toolId)
          .is('actual_return_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        setRecord(data as BorrowRecord | null)
      } finally {
        setLoading(false)
      }
    }
    
    setLoading(true)
    fetchRecord()
  }, [toolId])

  return { record, loading }
}
