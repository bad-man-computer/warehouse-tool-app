import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useInventoryTasks, useInventoryItems } from '@/hooks/useInventory'
import { useWarehouseStore } from '@/stores/warehouseStore'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { toast } from '@/utils/toast'
import type { ToolStatus } from '@/types'
import { TOOL_STATUS } from '@/constants/toolStatus'

export default function Inventory() {
  const { t } = useTranslation()
  const { currentId } = useWarehouseStore()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'
  const { tasks, loading: tasksLoading, refetch: refetchTasks } = useInventoryTasks(currentId)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const { items, loading: itemsLoading, refetch: refetchItems } = useInventoryItems(selectedTaskId)

  const currentTask = tasks.find((x) => x.id === selectedTaskId)
  const inProgressTasks = tasks.filter((x) => x.status === 'in_progress')

  const handleCreateTask = async () => {
    if (!currentId || !supabase) return
    try {
      const { data: taskRow, error: taskErr } = await supabase
        .from('inventory_tasks')
        .insert({ warehouse_id: currentId, status: 'in_progress' })
        .select('id')
        .single()
      if (taskErr || !taskRow) throw new Error(taskErr?.message ?? 'Failed to create task')
      const taskId = (taskRow as { id: string }).id
      toast.success(t('common.success'))
      refetchTasks()
      setSelectedTaskId(taskId)
    } catch (e) {
      toast.error(String(e))
    }
  }

  const handleCompleteTask = async () => {
    if (!selectedTaskId || !supabase) return
    try {
      await supabase
        .from('inventory_tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', selectedTaskId)
      toast.success(t('common.success'))
      refetchTasks()
    } catch (e) {
      toast.error(String(e))
    }
  }

  const handleConfirmAdjust = async (item: { tool_id: string | null; actual_status: ToolStatus | null }) => {
    if (!item.tool_id || item.actual_status == null || !supabase) {
      toast.error(t('inventory.adjustTip'))
      return
    }
    try {
      await supabase.from('tools').update({ status: item.actual_status }).eq('id', item.tool_id)
      await supabase.from('inventory_items').update({ difference_type: 'match' }).eq('task_id', selectedTaskId).eq('tool_id', item.tool_id)
      toast.success(t('common.success'))
      refetchItems()
    } catch (e) {
      toast.error(String(e))
    }
  }

  const differenceItems = items.filter((i) => i.difference_type && i.difference_type !== 'match')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">{t('nav.inventory')}</h1>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { setSelectedTaskId(null) }}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${!selectedTaskId ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          {t('inventory.start')}
        </button>
        {inProgressTasks.length > 0 && (() => {
         const firstTask = inProgressTasks[0]!
          return (
            <button
              type="button"
              onClick={() => { setSelectedTaskId(firstTask.id) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${selectedTaskId === firstTask.id ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              {t('inventory.scanCheck')}
            </button>
          )
        })()}
        {currentTask?.status === 'completed' && (
          <button
            type="button"
            onClick={() => setSelectedTaskId(currentTask.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${selectedTaskId === currentTask.id ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            {t('inventory.report')}
          </button>
        )}
      </div>

      {!selectedTaskId && (
        <section className="bg-white rounded-lg border overflow-hidden">
          <h2 className="px-4 py-3 font-medium text-gray-800 border-b">{t('inventory.selectWarehouse')}</h2>
          {tasksLoading ? (
            <div className="p-8 text-center text-gray-500">{t('common.loading')}</div>
          ) : (
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-2">当前仓库：{currentId ? '已选' : '请先在侧栏选择仓库'}</p>
              <button
                type="button"
                onClick={handleCreateTask}
                disabled={!currentId}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50"
              >
                {t('inventory.createTask')}
              </button>
              {tasks.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {tasks.map((task) => (
                    <li key={task.id} className="flex items-center justify-between border-b py-2">
                      <span className="text-sm">{task.id.slice(0, 8)}... {task.status === 'in_progress' ? t('inventory.inProgress') : '已完成'}</span>
                      <button
                        type="button"
                        onClick={() => { setSelectedTaskId(task.id) }}
                        className="text-primary-600 text-sm"
                      >
                        {task.status === 'in_progress' ? t('inventory.scanCheck') : t('inventory.report')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      {selectedTaskId && (
        <section className="bg-white rounded-lg border p-4">
          <h2 className="font-medium text-gray-800 mb-4">{t('inventory.scanCheck')}</h2>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder={t('tool.assetCode')}
              className="flex-1 border rounded-lg px-3 py-2"
              disabled
            />
            <button type="button" className="px-4 py-2 bg-gray-200 rounded-lg" disabled>
              {t('common.search')}
            </button>
          </div>
          <p className="text-sm text-gray-500">扫码盘点功能暂不可用，请使用"扫码录入"页面</p>
          <div className="mt-4">
            <button type="button" onClick={handleCompleteTask} className="px-4 py-2 bg-primary-600 text-white rounded-lg">
              完成盘点
            </button>
            <button type="button" onClick={() => setSelectedTaskId(null)} className="ml-2 px-4 py-2 border rounded-lg">
              {t('common.cancel')}
            </button>
          </div>
        </section>
      )}

      {selectedTaskId && items.length > 0 && (
        <section className="bg-white rounded-lg border overflow-hidden">
          <h2 className="px-4 py-3 font-medium text-gray-800 border-b">盘点明细</h2>
          {itemsLoading ? (
            <div className="p-8 text-center text-gray-500">{t('common.loading')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('tool.assetCode')}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('inventory.systemStatus')}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('inventory.actualStatus')}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">差异</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2 text-sm font-mono">{item.asset_code}</td>
                      <td className="px-4 py-2 text-sm">{item.expected_status ? t(TOOL_STATUS[item.expected_status].labelKey) : '—'}</td>
                      <td className="px-4 py-2 text-sm">{item.actual_status ? t(TOOL_STATUS[item.actual_status].labelKey) : '—'}</td>
                      <td className="px-4 py-2 text-sm">{item.difference_type || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {selectedTaskId && items.length > 0 && (
        <section className="bg-white rounded-lg border overflow-hidden">
          <h2 className="px-4 py-3 font-medium text-gray-800 border-b">{t('inventory.report')}</h2>
          {itemsLoading ? (
            <div className="p-8 text-center text-gray-500">{t('common.loading')}</div>
          ) : differenceItems.length === 0 ? (
            <div className="p-4">
              <p className="text-gray-500">无差异项</p>
            </div>
          ) : (
            <div className="p-4">
              <p className="text-sm text-gray-500 mb-2">{t('inventory.adjustTip')}</p>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('tool.assetCode')}</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('inventory.systemStatus')}</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('inventory.actualStatus')}</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">差异</th>
                      {isAdmin && <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {differenceItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2 text-sm font-mono">{item.asset_code}</td>
                        <td className="px-4 py-2 text-sm">{item.expected_status ? t(TOOL_STATUS[item.expected_status].labelKey) : '—'}</td>
                        <td className="px-4 py-2 text-sm">{item.actual_status ? t(TOOL_STATUS[item.actual_status].labelKey) : '—'}</td>
                        <td className="px-4 py-2 text-sm">{item.difference_type}</td>
                        {isAdmin && item.tool_id && item.actual_status && (
                          <td className="px-4 py-2">
                            <button
                              type="button"
                              onClick={() => handleConfirmAdjust(item)}
                              className="text-primary-600 text-sm hover:underline"
                            >
                              {t('inventory.confirmAdjust')}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={() => setSelectedTaskId(null)} className="mt-4 px-4 py-2 border rounded-lg">
                {t('common.cancel')}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}