import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Warehouse } from '@/types'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

const MOCK_WAREHOUSES: Warehouse[] = [
  { id: 'a0000000-0000-0000-0000-000000000001', code: 'CN', name_zh: '中国仓库', name_en: 'China Warehouse', timezone: 'Asia/Shanghai', currency: 'CNY' },
  { id: 'a0000000-0000-0000-0000-000000000002', code: 'SG', name_zh: '新加坡仓库', name_en: 'Singapore Warehouse', timezone: 'Asia/Singapore', currency: 'SGD' },
]

interface WarehouseState {
  list: Warehouse[]
  currentId: string | null
  setCurrent: (id: string) => void
  load: () => Promise<void>
  canSwitch: (warehouseId: string) => boolean
}

export const useWarehouseStore = create<WarehouseState>()(
  persist(
    (set, get) => ({
      list: MOCK_WAREHOUSES,
      currentId: null,

      setCurrent(id: string) {
        set({ currentId: id })
      },

      async load() {
        if (!isSupabaseConfigured() || !supabase) {
          const list = MOCK_WAREHOUSES
          set((s) => ({ list, currentId: s.currentId ?? list[0]?.id ?? null }))
          return
        }
        const { data } = await supabase.from('warehouses').select('*').order('code')
        if (data) set((s) => ({ list: data, currentId: s.currentId ?? data[0]?.id ?? null }))
      },

      canSwitch(warehouseId: string) {
        const { list } = get()
        return list.some((w) => w.id === warehouseId)
      },
    }),
    { name: 'warehouse-current', partialize: (s) => ({ currentId: s.currentId }) }
  )
)
