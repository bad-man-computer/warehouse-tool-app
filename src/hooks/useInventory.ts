import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { InventoryTask, InventoryItem, Tool } from '@/types'

export interface InventoryItemWithTool extends InventoryItem {
  tool?: Tool | null
}

export function useInventoryTasks(warehouseId: string | null) {
  const [tasks, setTasks] = useState<InventoryTask[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(() => {
    if (!warehouseId) {
      setTasks([])
      setLoading(false)
      return
    }
    setLoading(true)
    if (!isSupabaseConfigured() || !supabase) {
      setTasks([])
      setLoading(false)
      return
    }
    Promise.resolve(
      supabase
        .from('inventory_tasks')
        .select('*')
        .eq('warehouse_id', warehouseId)
        .eq('is_deleted', false)  // 只显示未删除的任务
        .order('created_at', { ascending: false })
        .then(({ data }) => setTasks((data as InventoryTask[]) ?? []))
    )
      .catch((error: unknown) => console.error('Failed to fetch inventory tasks:', error))
      .finally(() => setLoading(false))
  }, [warehouseId])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { tasks, loading, refetch: fetch }
}

/**
 * 某次盘点任务的明细列表
 */
export function useInventoryItems(taskId: string | null) {
  const [items, setItems] = useState<InventoryItemWithTool[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(() => {
    if (!taskId || !supabase) {
      setItems([])
      return
    }
    setLoading(true)
    if (!supabase) {
      setItems([])
      setLoading(false)
      return
    }
    Promise.resolve(
      supabase
        .from('inventory_items')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at')
        .then(({ data }) => setItems((data as InventoryItemWithTool[]) ?? []))
    )
      .catch((error: unknown) => console.error('Failed to fetch inventory items:', error))
      .finally(() => setLoading(false))
  }, [taskId])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { items, loading, refetch: fetch }
}
