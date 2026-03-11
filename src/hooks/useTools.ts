import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Tool } from '@/types'
import type { ToolStatus } from '@/types'

interface UseToolsOptions {
  warehouseId: string | null
  status?: ToolStatus | null
  search?: string
}

/**
 * 查询当前仓库下的工具列表，支持按状态和关键词筛选
 */
export function useTools(options: UseToolsOptions) {
  const { warehouseId, status, search = '' } = options
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    if (!warehouseId) {
      setTools([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    if (!isSupabaseConfigured() || !supabase) {
      setTools([])
      setLoading(false)
      return
    }
    let q = supabase
      .from('tools')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .is('deleted_at', null)
    if (status) q = q.eq('status', status)
    if (search.trim()) {
     const term = `%${search.trim()}%`
      q = q.or(`asset_code.ilike.${term},name_zh.ilike.${term},name_en.ilike.${term}`)
    }
    q.order('asset_code')
  const fetchTools = async () => {
       try {
      const { data, error: e } = await q
         if (e) setError(e.message)
        else setTools((data as Tool[]) ?? [])
      } finally {
        setLoading(false)
      }
    }
    fetchTools()
  }, [warehouseId, status, search])

  useEffect(() => {
    fetch()
  }, [fetch])

 return { tools, loading, error, refetch: fetch }
}

/**
 * 根据资产编号或 id 查询单条工具（当前仓库）
 */
export function useToolByCode(warehouseId: string | null, assetCodeOrId: string | null) {
  const [tool, setTool] = useState<Tool | null>(null)
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(() => {
    if (!warehouseId || !assetCodeOrId?.trim()) {
      setTool(null)
      return
    }
    setLoading(true)
    if (!supabase) {
      setTool(null)
      setLoading(false)
      return
    }
   const isUuid = /^[0-9a-f-]{36}$/i.test(assetCodeOrId.trim())
   const q = supabase
      .from('tools')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .is('deleted_at', null)
    if (isUuid) q.eq('id', assetCodeOrId.trim())
    else q.eq('asset_code', assetCodeOrId.trim())
  const fetchTool = async () => {
      try {
    const { data, error } = await q.single()
        if (error) setTool(null)
        else setTool(data as Tool)
      } finally {
        setLoading(false)
      }
    }
    fetchTool()
  }, [warehouseId, assetCodeOrId])

  useEffect(() => {
    fetch()
  }, [fetch])

 return { tool, loading, refetch: fetch }
}
