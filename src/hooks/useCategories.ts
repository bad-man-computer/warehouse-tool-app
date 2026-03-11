import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { ToolCategory } from '@/types'

export function useCategories(warehouseId: string | null) {
  const [categories, setCategories] = useState<ToolCategory[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!warehouseId || !supabase || !isSupabaseConfigured()) {
      setCategories([])
      return
    }
    setLoading(true)
   const fetchCategories = async () => {
      try {
       const { data } = await supabase!
          .from('tool_categories')
          .select('*')
          .eq('warehouse_id', warehouseId)
          .order('created_at', { ascending: true })
        setCategories((data as ToolCategory[]) ?? [])
      } finally {
        setLoading(false)
      }
    }
    fetchCategories()
  }, [warehouseId])

  return { categories, loading }
}

