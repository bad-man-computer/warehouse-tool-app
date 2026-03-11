import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ReactECharts from 'echarts-for-react'
import { useWarehouseStore } from '@/stores/warehouseStore'
import {
  useStatusCounts,
  useMonthlyStats,
  useWarehouseCompare,
  useTopBorrowers,
  useTopRepairedTools,
  useOverdueList,
} from '@/hooks/useReports'
import { TOOL_STATUS } from '@/constants/toolStatus'
import { formatDateTime } from '@/utils/format'
import { exportCsv } from '@/utils/exportCsv'

export default function Reports() {
  const { t, i18n } = useTranslation()
  const currentId = useWarehouseStore((s) => s.currentId)
  const warehouseList = useWarehouseStore((s) => s.list)

  const { counts, loading: loadingCounts } = useStatusCounts(currentId)
  const { stats, loading: loadingStats } = useMonthlyStats(currentId)
  const warehouseIds = useMemo(() => warehouseList.map((w) => w.id), [warehouseList])
  const warehouseNames = useMemo(() => Object.fromEntries(warehouseList.map((w) => [w.id, i18n.language === 'en' ? w.name_en : w.name_zh])), [warehouseList, i18n.language])
  const { rows: compareRows, loading: loadingCompare } = useWarehouseCompare(warehouseIds, warehouseNames)
  const { list: topBorrowers, loading: loadingBorrowers } = useTopBorrowers(currentId, 10)
  const { list: topRepaired, loading: loadingRepaired } = useTopRepairedTools(currentId, 10)
  const { list: overdueList, loading: loadingOverdue } = useOverdueList(currentId)

  const nameKey = i18n.language === 'en' ? 'name_en' : 'name_zh'

  const pieOption = useMemo(() => {
    const data = counts.map((c) => ({ value: c.count, name: t(TOOL_STATUS[c.status].labelKey) }))
    return {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [{ type: 'pie', radius: '60%', data }] as const,
    }
  }, [counts, t])

  const lineOption = useMemo(() => {
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: [t('reports.borrowCount'), t('reports.returnCount'), t('reports.repairCount')] },
      xAxis: { type: 'category', data: stats.map((s) => s.month) },
      yAxis: { type: 'value' },
      series: [
        { name: t('reports.borrowCount'), type: 'line', data: stats.map((s) => s.borrow) },
        { name: t('reports.returnCount'), type: 'line', data: stats.map((s) => s.return) },
        { name: t('reports.repairCount'), type: 'line', data: stats.map((s) => s.repair) },
      ],
    }
  }, [stats, t])

  const barOption = useMemo(() => {
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: [t('reports.totalTools'), t('reports.borrowRate'), t('reports.damageRate')] },
      xAxis: { type: 'category', data: compareRows.map((r) => r.warehouseName) },
      yAxis: [{ type: 'value', name: t('reports.totalTools') }, { type: 'value', name: '%', max: 100 }],
      series: [
        { name: t('reports.totalTools'), type: 'bar', data: compareRows.map((r) => r.total) },
        { name: t('reports.borrowRate'), type: 'line', yAxisIndex: 1, data: compareRows.map((r) => Number(r.borrowRate.toFixed(1))) },
        { name: t('reports.damageRate'), type: 'line', yAxisIndex: 1, data: compareRows.map((r) => Number(r.damageRate.toFixed(1))) },
      ],
    }
  }, [compareRows, t])

  const handleExportOverdue = () => {
    const header = [t('borrow.borrowerName'), t('borrow.department'), t('tool.assetCode'), t('tool.name'), t('borrow.expectedReturn'), t('reports.overdueDays')]
    const rows = overdueList.map((r) => [r.borrower_name, r.department, r.asset_code, r.tool_name, formatDateTime(r.expected_return_at), String(r.overdueDays)])
    exportCsv([header, ...rows], `overdue-${new Date().toISOString().slice(0, 10)}`)
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-gray-800">{t('nav.reports')}</h1>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border p-4">
          <h2 className="font-medium text-gray-800 mb-4">{t('reports.statusDistribution')}</h2>
          {loadingCounts ? <div className="h-64 flex items-center justify-center text-gray-500">{t('common.loading')}</div> : (
            <ReactECharts option={pieOption} style={{ height: 280 }} />
          )}
        </div>
        <div className="bg-white rounded-lg border p-4">
          <h2 className="font-medium text-gray-800 mb-4">{t('reports.monthlyTrend')}</h2>
          {loadingStats ? <div className="h-64 flex items-center justify-center text-gray-500">{t('common.loading')}</div> : (
            <ReactECharts option={lineOption} style={{ height: 280 }} />
          )}
        </div>
      </section>

      <section className="bg-white rounded-lg border p-4">
        <h2 className="font-medium text-gray-800 mb-4">{t('reports.warehouseCompare')}</h2>
        {loadingCompare ? <div className="h-64 flex items-center justify-center text-gray-500">{t('common.loading')}</div> : (
          <ReactECharts option={barOption} style={{ height: 280 }} />
        )}
      </section>

      <section className="bg-white rounded-lg border overflow-hidden">
        <h2 className="px-4 py-3 font-medium text-gray-800 border-b">{t('reports.topBorrowers')}</h2>
        {loadingBorrowers ? <div className="p-8 text-center text-gray-500">{t('common.loading')}</div> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('borrow.borrowerName')}</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('borrow.department')}</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('reports.borrowTimes')}</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('reports.unreturnedCount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {topBorrowers.map((row, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-sm">{row.borrower_name}</td>
                    <td className="px-4 py-2 text-sm">{row.department}</td>
                    <td className="px-4 py-2 text-sm">{row.borrowTimes}</td>
                    <td className="px-4 py-2 text-sm">{row.unreturnedCount}</td>
                  </tr>
                ))}
                {topBorrowers.length === 0 && <tr><td colSpan={4} className="px-4 py-4 text-center text-gray-500">暂无数据</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white rounded-lg border overflow-hidden">
        <h2 className="px-4 py-3 font-medium text-gray-800 border-b">{t('reports.topRepairedTools')}</h2>
        {loadingRepaired ? <div className="p-8 text-center text-gray-500">{t('common.loading')}</div> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('tool.assetCode')}</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('tool.name')}</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('reports.repairTimes')}</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('reports.totalRepairCost')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {topRepaired.map((row) => (
                  <tr key={row.tool_id}>
                    <td className="px-4 py-2 text-sm font-mono">{row.asset_code}</td>
                    <td className="px-4 py-2 text-sm">{row[nameKey] || row.name_zh}</td>
                    <td className="px-4 py-2 text-sm">{row.repairTimes}</td>
                    <td className="px-4 py-2 text-sm">{row.totalCost}</td>
                  </tr>
                ))}
                {topRepaired.length === 0 && <tr><td colSpan={4} className="px-4 py-4 text-center text-gray-500">暂无数据</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white rounded-lg border overflow-hidden">
        <div className="px-4 py-3 font-medium text-gray-800 border-b flex justify-between items-center">
          <span>{t('reports.overdueList')}</span>
          <button type="button" onClick={handleExportOverdue} className="text-sm text-primary-600 hover:underline">{t('reports.exportCSV')}</button>
        </div>
        {loadingOverdue ? <div className="p-8 text-center text-gray-500">{t('common.loading')}</div> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('borrow.borrowerName')}</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('tool.assetCode')}</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('borrow.expectedReturn')}</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('reports.overdueDays')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {overdueList.map((r) => (
                  <tr key={r.id} className="bg-red-50">
                    <td className="px-4 py-2 text-sm">{r.borrower_name}</td>
                    <td className="px-4 py-2 text-sm font-mono">{r.asset_code}</td>
                    <td className="px-4 py-2 text-sm">{formatDateTime(r.expected_return_at)}</td>
                    <td className="px-4 py-2 text-sm text-red-600">{r.overdueDays}</td>
                  </tr>
                ))}
                {overdueList.length === 0 && <tr><td colSpan={4} className="px-4 py-4 text-center text-gray-500">暂无逾期</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
