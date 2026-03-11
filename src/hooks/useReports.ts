import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { ToolStatus } from '@/types'

export interface StatusCount {
  status: ToolStatus
  count: number
}

export interface MonthlyStat {
  month: string
  borrow: number
  return: number
  repair: number
}

export interface WarehouseCompareRow {
  warehouseId: string
  warehouseName: string
  total: number
  borrowRate: number
  damageRate: number
}

export interface TopBorrower {
  borrower_name: string
  department: string
  borrowTimes: number
  unreturnedCount: number
}

export interface TopRepairedTool {
  tool_id: string
  asset_code: string
  name_zh: string
  name_en: string
  repairTimes: number
  totalCost: number
}

export interface OverdueRow {
  id: string
  borrower_name: string
  department: string
  asset_code: string
  tool_name: string
  expected_return_at: string
  overdueDays: number
}

/**
 * 当前仓库工具按状态数量
 */
export function useStatusCounts(warehouseId: string | null) {
  const [counts, setCounts] = useState<StatusCount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!warehouseId || !supabase) {
      setCounts([])
      setLoading(false)
      return
    }
    
    const fetchCounts = async () => {
      if (!supabase) return
      
      try {
        const { data } = await supabase
          .from('tools')
          .select('status')
          .eq('warehouse_id', warehouseId)
          .is('deleted_at', null)
        
        const map = new Map<string, number>()
        ;(data ?? []).forEach((r: { status: string }) => {
          map.set(r.status, (map.get(r.status) ?? 0) + 1)
        })
        setCounts(Array.from(map.entries()).map(([status, count]) => ({ status: status as ToolStatus, count })))
      } finally {
        setLoading(false)
      }
    }
    
    setLoading(true)
    fetchCounts()
  }, [warehouseId])

  return { counts, loading }
}

/**
 * 近12个月借出/归还/维修数量（当前仓库）
 */
export function useMonthlyStats(warehouseId: string | null) {
  const [stats, setStats] = useState<MonthlyStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!warehouseId || !supabase) {
      setStats([])
      setLoading(false)
      return
    }
    
    const fetchStats = async () => {
      if (!supabase) return
      
      const months: MonthlyStat[] = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        months.push({
          month: `${d.getFullYear()}-${String(d.getMonth() +1).padStart(2, '0')}`,
          borrow: 0,
          return: 0,
          repair: 0,
        })
      }

      try {
        const { data: toolRows } = await supabase.from('tools').select('id').eq('warehouse_id', warehouseId)
        const toolIds = (toolRows ?? []).map((t: { id: string }) => t.id)
        if (toolIds.length === 0) {
          setStats(months)
          return
        }
        const [borrowRes, repairRes] = await Promise.all([
          supabase.from('borrow_records').select('created_at, actual_return_at').in('tool_id', toolIds),
          supabase.from('repair_records').select('reported_at, tool_id').in('tool_id', toolIds),
        ])
        const borrowList = borrowRes.data ?? []
        borrowList.forEach((b: { created_at: string; actual_return_at: string | null }) => {
          const m = b.created_at.slice(0, 7)
          const row = months.find((x) => x.month === m)
          if (row) row.borrow++
          if (b.actual_return_at) {
            const mr = b.actual_return_at.slice(0, 7)
            const rowr = months.find((x) => x.month === mr)
            if (rowr) rowr.return++
          }
        })
        ;(repairRes.data ?? []).forEach((r: { reported_at: string }) => {
          const m = r.reported_at.slice(0, 7)
          const row = months.find((x) => x.month === m)
          if (row) row.repair++
        })
        setStats(months)
      } finally {
        setLoading(false)
      }
    }
    
    setLoading(true)
    fetchStats()
  }, [warehouseId])

  return { stats, loading }
}

/**
 * 简化：从 borrow_records 按仓库统计（需先拿到各仓库 tool_id 列表）
 */
export function useWarehouseCompare(warehouseIds: string[], warehouseNames: Record<string, string>) {
  const [rows, setRows] = useState<WarehouseCompareRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase || warehouseIds.length === 0) {
      setRows([])
      setLoading(false)
      return
    }
    
    const fetchCompare = async () => {
      if (!supabase) return
      
      try {
        const results = await Promise.all(
          warehouseIds.map(async (wid) => {
            const { data: tools } = await supabase!.from('tools').select('id, status').eq('warehouse_id', wid).is('deleted_at', null)
            const total = tools?.length ?? 0
            const borrowed = tools?.filter((t: { status: string }) => t.status === 'borrowed').length ?? 0
            const damaged = tools?.filter((t: { status: string }) => t.status === 'damaged' || t.status === 'repairing').length ?? 0
            return {
              warehouseId: wid,
              warehouseName: warehouseNames[wid] ?? wid,
              total,
              borrowRate: total ? (borrowed / total) * 100 : 0,
              damageRate: total ? (damaged / total) * 100 : 0,
            }
          })
        )
        setRows(results)
      } finally {
        setLoading(false)
      }
    }
    
    setLoading(true)
    fetchCompare()
  }, [warehouseIds.join(','), JSON.stringify(warehouseNames)])

  return { rows, loading }
}

/**
 * 高频借用人员（当前仓库）
 */
export function useTopBorrowers(warehouseId: string | null, limit = 10) {
  const [list, setList] = useState<TopBorrower[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!warehouseId || !supabase) {
      setList([])
      setLoading(false)
      return
    }
    
    const fetchBorrowers = async () => {
      if (!supabase) return
      
      try {
        const { data: toolRows } = await supabase.from('tools').select('id').eq('warehouse_id', warehouseId)
        const ids = (toolRows ?? []).map((t: { id: string }) => t.id)
        if (ids.length === 0) {
          setList([])
          return
        }
        const { data: records } = await supabase
          .from('borrow_records')
          .select('borrower_name, department, tool_id, actual_return_at')
          .in('tool_id', ids)
        
        const byName = new Map<string, { borrowTimes: number; unreturned: number; department: string }>()
        ;(records ?? []).forEach((r: { borrower_name: string; department: string; actual_return_at: string | null }) => {
          const key = r.borrower_name
          if (!byName.has(key)) byName.set(key, { borrowTimes: 0, unreturned: 0, department: r.department ?? '' })
          const cur = byName.get(key)!
          cur.borrowTimes++
          if (!r.actual_return_at) cur.unreturned++
        })
        setList(
          Array.from(byName.entries())
            .map(([borrower_name, v]) => ({ borrower_name, department: v.department, borrowTimes: v.borrowTimes, unreturnedCount: v.unreturned }))
            .sort((a, b) => b.borrowTimes - a.borrowTimes)
            .slice(0, limit)
        )
      } finally {
        setLoading(false)
      }
    }
    
    setLoading(true)
    fetchBorrowers()
  }, [warehouseId, limit])

  return { list, loading }
}

/**
 * 高频维修工具（当前仓库）
 */
export function useTopRepairedTools(warehouseId: string | null, limit = 10) {
  const [list, setList] = useState<TopRepairedTool[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!warehouseId || !supabase) {
      setList([])
      setLoading(false)
      return
    }
    
    const fetchRepairedTools = async () => {
      if (!supabase) return
      
      try {
        const { data: toolList } = await supabase.from('tools').select('id, asset_code, name_zh, name_en').eq('warehouse_id', warehouseId)
        const toolMap = new Map((toolList ?? []).map((t: { id: string; asset_code: string; name_zh: string; name_en: string }) => [t.id, t]))
        
        const { data: repairs } = await supabase
          .from('repair_records')
          .select('tool_id, cost')
          .in('tool_id', Array.from(toolMap.keys()))
        
        const byTool = new Map<string, { times: number; cost: number }>()
        ;(repairs ?? []).forEach((r: { tool_id: string; cost: number | null }) => {
          if (!byTool.has(r.tool_id)) byTool.set(r.tool_id, { times: 0, cost: 0 })
          const cur = byTool.get(r.tool_id)!
          cur.times++
          cur.cost += Number(r.cost ?? 0)
        })
        setList(
          Array.from(byTool.entries())
            .map(([tool_id, v]) => {
              const t = toolMap.get(tool_id)
              return { tool_id, asset_code: t?.asset_code ?? '', name_zh: t?.name_zh ?? '', name_en: t?.name_en ?? '', repairTimes: v.times, totalCost: v.cost }
            })
            .sort((a, b) => b.repairTimes - a.repairTimes)
            .slice(0, limit)
        )
      } finally {
        setLoading(false)
      }
    }
    
    setLoading(true)
    fetchRepairedTools()
  }, [warehouseId, limit])

  return { list, loading }
}

/**
 * 逾期未还清单（当前仓库）
 */
export function useOverdueList(warehouseId: string | null) {
  const [list, setList] = useState<OverdueRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!warehouseId || !supabase) {
      setList([])
      setLoading(false)
      return
    }
    
    const fetchOverdue = async () => {
      if (!supabase) return
      
      try {
        const { data: tools } = await supabase.from('tools').select('id, asset_code, name_zh, name_en').eq('warehouse_id', warehouseId)
        const toolIds = (tools ?? []).map((t: { id: string }) => t.id)
        const toolMap = new Map((tools ?? []).map((t: { id: string; asset_code: string; name_zh: string; name_en: string }) => [t.id, t]))
        if (toolIds.length === 0) {
          setList([])
          return
        }
        
        const { data: records } = await supabase
          .from('borrow_records')
          .select('id, tool_id, borrower_name, department, expected_return_at')
          .in('tool_id', toolIds)
          .is('actual_return_at', null)
        
        const now = Date.now()
        setList(
          (records ?? [])
            .filter((r: { expected_return_at: string }) => new Date(r.expected_return_at).getTime() < now)
            .map((r: { id: string; tool_id: string; borrower_name: string; department: string; expected_return_at: string }) => {
              const t = toolMap.get(r.tool_id)
              const overdueDays = Math.floor((now - new Date(r.expected_return_at).getTime()) / (24 * 60 * 60 * 1000))
              return {
                id: r.id,
                borrower_name: r.borrower_name,
                department: r.department ?? '',
                asset_code: t?.asset_code ?? '',
                tool_name: t?.name_zh ?? t?.name_en ?? '',
                expected_return_at: r.expected_return_at,
                overdueDays,
              }
            })
        )
      } finally {
        setLoading(false)
      }
    }
    
    setLoading(true)
    fetchOverdue()
  }, [warehouseId])

  return { list, loading }
}
