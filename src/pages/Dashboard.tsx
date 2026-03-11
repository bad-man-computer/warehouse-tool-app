import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useWarehouseStore } from '@/stores/warehouseStore'
import { TOOL_STATUS } from '@/constants/toolStatus'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { ToolStatus } from '@/types'

const ALL_STATUSES: ToolStatus[] = ['available', 'borrowed', 'returned', 'damaged', 'repairing', 'lost']

export default function Dashboard() {
  const { t } = useTranslation()
  const currentId = useWarehouseStore((s) => s.currentId)
  const list = useWarehouseStore((s) => s.list)
  const current = list.find((w) => w.id === currentId) ?? list[0]
  const [counts, setCounts] = useState<Record<ToolStatus, number>>(() =>
    Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<ToolStatus, number>
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!currentId || !supabase || !isSupabaseConfigured()) {
      setCounts(Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<ToolStatus, number>)
      return
    }
    setLoading(true)
  const fetchCounts = async () => {
      try {
  const { data, error } = await supabase!
          .from('tools')
          .select('status')
          .eq('warehouse_id', currentId)
          .is('deleted_at', null)
        if (error) {
          setCounts(Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<ToolStatus, number>)
          return
        }
    const next = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<ToolStatus, number>
        ;(data ?? []).forEach((r: { status: ToolStatus }) => {
          next[r.status] = (next[r.status] ?? 0) +1
        })
        setCounts(next)
      } finally {
        setLoading(false)
      }
    }
    fetchCounts()
  }, [currentId])

  const data = useMemo(
    () =>
      ALL_STATUSES.map((status) => ({
        name: t(TOOL_STATUS[status].labelKey),
        count: counts[status] ?? 0,
      })),
    [counts, t]
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">{t('dashboard.title')}</h1>
        <p className="text-gray-500 mt-1">
          {current ? `${current.name_zh} (${current.code})` : t('common.noData')}
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {ALL_STATUSES.map((status) => (
          <div
            key={status}
            className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
          >
            <p className="text-sm text-gray-500">{t(TOOL_STATUS[status].labelKey)}</p>
            <p className="text-2xl font-semibold text-gray-800 mt-1">{counts[status] ?? 0}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <h2 className="text-lg font-medium text-gray-800 mb-4">{t('dashboard.byStatus')}</h2>
        <div className="h-64">
          {loading ? (
            <div className="h-64 flex items-center justify-center text-gray-500">{t('common.loading')}</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
