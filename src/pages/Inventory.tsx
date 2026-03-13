import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { useInventoryTasks, useInventoryItems } from '@/hooks/useInventory'
import { useWarehouseStore } from '@/stores/warehouseStore'
import { useAuthStore } from '@/stores/authStore'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { ToolStatus } from '@/types'
import { TOOL_STATUS } from '@/constants/toolStatus'
import { formatDate } from '@/utils/format'

// 盘点步骤类型
type InventoryStep = 'list' | 'scan' | 'review' | 'report'

export default function Inventory() {
  const { t, i18n } = useTranslation()
  const currentId = useWarehouseStore((s) => s.currentId)
  const user = useAuthStore((s) => s.user)
  
  const [step, setStep] = useState<InventoryStep>('list')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [scannedToolId, setScannedToolId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  
  const { tasks, loading: tasksLoading, refetch: refetchTasks } = useInventoryTasks(currentId)
  const { items, loading: itemsLoading, refetch: refetchItems } = useInventoryItems(selectedTaskId)
  
  const currentTask = tasks.find((x) => x.id === selectedTaskId)
  
  const nameKey = i18n.language === 'en' ? 'name_en' : 'name_zh'
  
  // 创建盘点任务
  const handleCreateTask = async () => {
    if (!currentId || !supabase || !isSupabaseConfigured()) return
    setCreating(true)
    
    try {
      // 1. 获取当前仓库所有工具
      const { data: tools, error: toolsError } = await supabase!
        .from('tools')
        .select('id, asset_code, status')
        .eq('warehouse_id', currentId)
        .is('deleted_at', null)
      
      if (toolsError) throw toolsError
      
      if (!tools || tools.length === 0) {
        toast.error('当前仓库没有工具，无法创建盘点任务')
        setCreating(false)
        return
      }
      
      // 2. 创建任务
      const taskName = `${t('inventory.task')} ${new Date().toLocaleDateString(i18n.language)}`
      const { data: task, error: taskError } = await supabase!
        .from('inventory_tasks')
        .insert({
          warehouse_id: currentId,
          operator_id: user?.id,
          name: taskName,
          description_zh: `创建于 ${new Date().toLocaleString('zh-CN')}`,
          description_en: `Created at ${new Date().toLocaleString('en-US')}`,
          status: 'in_progress',
          total_items: tools.length,
          scanned_items: 0,
          match_count: 0,
          surplus_count: 0,
          shortage_count: 0,
        })
        .select('id')
        .single()
      
      if (taskError) throw taskError
      if (!task) throw new Error('Failed to create task')
      
      // 3. 生成盘点清单
      const inventoryItems = tools.map(tool => ({
        task_id: task.id,
        tool_id: tool.id,
        asset_code: tool.asset_code,
        expected_status: tool.status,
        actual_status: null as ToolStatus | null,
        difference_type: null,
        notes: null,
        operator_id: null,
        actual_quantity: null,
        expected_quantity: 1,
      }))
      
      const { error: itemsError } = await supabase!
        .from('inventory_items')
        .insert(inventoryItems)
      
      if (itemsError) throw itemsError
      
      toast.success(t('common.success'))
      refetchTasks()
      setSelectedTaskId(task.id)
      setStep('scan')
    } catch (error: any) {
      console.error('创建盘点任务失败:', error)
      toast.error(error.message || t('common.error'))
    } finally {
      setCreating(false)
    }
  }
  
  // 扫描工具
  const handleScanTool = async (assetCode: string) => {
    if (!selectedTaskId || !currentId || !supabase) return
    
    try {
      // 查找工具
      const { data: tool, error: toolError } = await supabase!
        .from('tools')
        .select('id, asset_code, name_zh, name_en, status')
        .eq('warehouse_id', currentId)
        .eq('asset_code', assetCode.trim())
        .is('deleted_at', null)
        .single()
      
      if (toolError || !tool) {
        // 工具不存在 - 盘盈
        const confirmSurplus = window.confirm(
          `未找到资产编号为 "${assetCode}" 的工具记录。\n\n是否要记录为盘盈（新增工具）？`
        )
        
        if (confirmSurplus) {
          // TODO: 实现盘盈流程 - 这里可以先记录到 inventory_items
          const { error: insertError } = await supabase!
            .from('inventory_items')
            .insert({
              task_id: selectedTaskId,
              asset_code: assetCode.trim(),
              expected_status: null,
              actual_status: 'available',
              difference_type: 'surplus',
              notes: '扫码发现未登记工具',
              operator_id: user?.id,
            })
          
          if (insertError) throw insertError
          toast.success('已记录盘盈工具')
          refetchItems()
        }
        return
      }
      
      // 检查是否已在盘点清单中
      const existingItem = items.find(item => item.tool_id === tool.id)
      
      if (existingItem && existingItem.actual_status !== null) {
        toast.error(`工具 "${tool[nameKey]}" 已经被盘点过`)
        setScannedToolId(tool.id)
        return
      }
      
      // 打开盘点对话框
      setScannedToolId(tool.id)
    } catch (error: any) {
      console.error('扫描工具失败:', error)
      toast.error(error.message || '扫描失败')
    }
  }
  
  // 确认盘点结果
  const handleConfirmScan = async (actualStatus: ToolStatus, notes?: string) => {
    if (!selectedTaskId || !scannedToolId) return
    
    try {
      // 找到对应的盘点项
      const item = items.find(i => i.tool_id === scannedToolId)
      
      if (!item) {
        // 如果不在清单中，创建新项
        const { error: insertError } = await supabase!
          .from('inventory_items')
          .insert({
            task_id: selectedTaskId,
            tool_id: scannedToolId,
            asset_code: '', // 会从 tool 表关联获取
            expected_status: null,
            actual_status: actualStatus,
            difference_type: 'match',
            notes,
            operator_id: user?.id,
          })
        
        if (insertError) throw insertError
      } else {
        // 更新现有项
        const differenceType = item.expected_status === actualStatus ? 'match' : 
                               actualStatus === 'lost' ? 'shortage' : 'surplus'
        
        const { error: updateError } = await supabase!
          .from('inventory_items')
          .update({
            actual_status: actualStatus,
            difference_type: differenceType,
            notes: notes || item.notes,
            operator_id: user?.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id)
        
        if (updateError) throw updateError
        
        // 如果是盘亏，立即更新工具状态
        if (differenceType === 'shortage') {
          await supabase!
            .from('tools')
            .update({ status: 'lost', deleted_at: new Date().toISOString() })
            .eq('id', scannedToolId)
        }
      }
      
      toast.success(t('common.success'))
      setScannedToolId(null)
      refetchItems()
      refetchTasks() // 更新统计数据
    } catch (error: any) {
      console.error('确认盘点失败:', error)
      toast.error(error.message || t('common.error'))
    }
  }
  
  // 完成盘点任务
  const handleCompleteTask = async () => {
    if (!selectedTaskId || !supabase) return
    
    const unscannedCount = items.filter(i => i.actual_status === null).length
    if (unscannedCount > 0) {
      const confirm = window.confirm(
        `还有 ${unscannedCount} 个工具未盘点，确定要结束本次盘点吗？\n\n未盘点的工具将自动标记为盘亏。`
      )
      if (!confirm) return
    }
    
    try {
      // 更新未完成的项目为盘亏
      const { error: updateError } = await supabase!
        .from('inventory_items')
        .update({
          actual_status: 'lost',
          difference_type: 'shortage',
          notes: '盘点未完成自动标记',
          updated_at: new Date().toISOString(),
        })
        .eq('task_id', selectedTaskId)
        .is('actual_status', null)
      
      if (updateError) throw updateError
      
      // 完成的任务
      await supabase!
        .from('inventory_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', selectedTaskId)
      
      toast.success('盘点已完成')
      refetchTasks()
      setStep('report')
    } catch (error: any) {
      console.error('完成盘点失败:', error)
      toast.error(error.message || t('common.error'))
    }
  }
  
  // 渲染不同步骤的界面
  const renderStep = () => {
    switch (step) {
      case 'list':
        return renderTaskList()
      case 'scan':
        return renderScanPage()
      case 'review':
        return renderReviewPage()
      case 'report':
        return renderReportPage()
      default:
        return null
    }
  }
  
  // 1. 任务列表
  const renderTaskList = () => (
    <section className="bg-white rounded-lg border overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h2 className="font-medium text-gray-800">{t('inventory.tasks')}</h2>
      </div>
      
      {tasksLoading ? (
        <div className="p-8 text-center text-gray-500">{t('common.loading')}</div>
      ) : (
        <div className="p-4">
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">
              {t('inventory.currentWarehouse')}: {currentId ? t('common.selected') : t('common.notSelected')}
            </p>
            <button
              type="button"
              onClick={handleCreateTask}
              disabled={!currentId || creating}
              className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50 hover:bg-primary-700 transition-colors"
            >
              {creating ? t('common.loading') : t('inventory.createTask')}
            </button>
          </div>
          
          {tasks.length > 0 && (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">
                      {task.name || `${t('inventory.task')} #${task.id.slice(0, 8)}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(task.created_at)} · {task.scanned_items}/{task.total_items} {t('inventory.items')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      task.status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {task.status === 'completed' ? t('inventory.completed') : t('inventory.inProgress')}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTaskId(task.id)
                        setStep(task.status === 'completed' ? 'report' : 'scan')
                      }}
                      className="text-primary-600 text-sm hover:underline"
                    >
                      {task.status === 'completed' ? t('inventory.report') : t('inventory.scanCheck')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
  
  // 2. 扫码盘点页面
  const renderScanPage = () => {
    if (!currentTask) return null
    
    const progress = currentTask.total_items > 0 
      ? Math.round((currentTask.scanned_items / currentTask.total_items) * 100) 
      : 0
    
    return (
      <section className="bg-white rounded-lg border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-gray-800">{currentTask.name || t('inventory.scanCheck')}</h2>
          <button
            type="button"
            onClick={() => setStep('list')}
            className="text-gray-500 hover:underline text-sm"
          >
            {t('common.back')}
          </button>
        </div>
        
        {/* 进度条 */}
        <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
          <div 
            className="bg-primary-600 h-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>{t('inventory.progress')}: {progress}%</span>
          <span>{currentTask.scanned_items} / {currentTask.total_items}</span>
        </div>
        
        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-green-50 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-green-600">{currentTask.match_count}</p>
            <p className="text-xs text-green-700">{t('inventory.match')}</p>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-600">{currentTask.surplus_count}</p>
            <p className="text-xs text-blue-700">{t('inventory.surplus')}</p>
          </div>
          <div className="bg-red-50 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-red-600">{currentTask.shortage_count}</p>
            <p className="text-xs text-red-700">{t('inventory.shortage')}</p>
          </div>
        </div>
        
        {/* 扫码输入框 */}
        <div className="pt-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('inventory.scanTool')}
          </label>
          <input
            type="text"
            placeholder={t('tool.assetCode')}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleScanTool(e.currentTarget.value)
                e.currentTarget.value = ''
              }
            }}
          />
          <p className="text-xs text-gray-500 mt-1">
            💡 使用扫码枪或手动输入资产编号，按回车确认
          </p>
        </div>
        
        {/* 最近扫描 */}
        {items.length > 0 && (
          <div className="border-t pt-4">
            <h3 className="font-medium text-gray-700 mb-2">{t('inventory.recentScans')}</h3>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {items
                .filter(i => i.actual_status !== null)
                .slice(-10)
                .reverse()
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <div>
                      <p className="font-medium text-sm">{item.asset_code}</p>
                      <p className="text-xs text-gray-500">
                        {item.expected_status && item.actual_status && item.expected_status !== item.actual_status
                          ? `${TOOL_STATUS[item.expected_status].labelKey} → ${TOOL_STATUS[item.actual_status].labelKey}`
                          : TOOL_STATUS[item.actual_status!]?.labelKey
                        }
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      item.difference_type === 'match' ? 'bg-green-100 text-green-800' :
                      item.difference_type === 'surplus' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {item.difference_type ? t(`inventory.${item.difference_type}`) : '-'}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
        
        {/* 完成按钮 */}
        <div className="pt-4 border-t">
          <button
            type="button"
            onClick={handleCompleteTask}
            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            {t('inventory.completeTask')}
          </button>
        </div>
      </section>
    )
  }
  
  // 3. 差异审核页面（预留）
  const renderReviewPage = () => (
    <section className="bg-white rounded-lg border p-4">
      <h2 className="font-medium text-gray-800 mb-4">{t('inventory.reviewDifferences')}</h2>
      <p className="text-gray-500">功能开发中...</p>
    </section>
  )
  
  // 4. 盘点报告页面
  const renderReportPage = () => {
    if (!currentTask) return null
    
    const accuracy = currentTask.scanned_items > 0
      ? Math.round((currentTask.match_count / currentTask.scanned_items) * 100)
      : 0
    
    return (
      <section className="bg-white rounded-lg border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-gray-800">{t('inventory.report')}</h2>
          <button
            type="button"
            onClick={() => setStep('list')}
            className="text-gray-500 hover:underline text-sm"
          >
            {t('common.back')}
          </button>
        </div>
        
        <div className="text-center py-6">
          <p className="text-4xl font-bold text-primary-600">{accuracy}%</p>
          <p className="text-gray-600 mt-2">{t('inventory.accuracy')}</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">{t('inventory.totalItems')}</p>
            <p className="text-2xl font-bold text-gray-800">{currentTask.total_items}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">{t('inventory.scannedItems')}</p>
            <p className="text-2xl font-bold text-gray-800">{currentTask.scanned_items}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-600">{t('inventory.match')}</p>
            <p className="text-2xl font-bold text-green-700">{currentTask.match_count}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-600">{t('inventory.surplus')}</p>
            <p className="text-2xl font-bold text-blue-700">{currentTask.surplus_count}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-sm text-red-600">{t('inventory.shortage')}</p>
            <p className="text-2xl font-bold text-red-700">{currentTask.shortage_count}</p>
          </div>
        </div>
        
        <div className="border-t pt-4">
          <h3 className="font-medium text-gray-700 mb-2">{t('inventory.details')}</h3>
          {itemsLoading ? (
            <p className="text-gray-500 text-center py-4">{t('common.loading')}</p>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-2">
              {items.filter(i => i.difference_type && i.difference_type !== 'match').map((item) => (
                <div key={item.id} className="p-3 bg-gray-50 rounded flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{item.asset_code}</p>
                    <p className="text-xs text-gray-500">
                      {item.expected_status ? TOOL_STATUS[item.expected_status].labelKey : '-'} → 
                      {' '}{item.actual_status ? TOOL_STATUS[item.actual_status].labelKey : '-'}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    item.difference_type === 'surplus' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {t(`inventory.${item.difference_type}`)}
                  </span>
                </div>
              ))}
              {items.filter(i => i.difference_type && i.difference_type !== 'match').length === 0 && (
                <p className="text-gray-500 text-center py-4">无差异项</p>
              )}
            </div>
          )}
        </div>
      </section>
    )
  }
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">{t('nav.inventory')}</h1>
      {renderStep()}
      
      {/* 扫码工具对话框 */}
      {scannedToolId && (
        <ScanConfirmModal
          toolId={scannedToolId}
          items={items}
          onConfirm={handleConfirmScan}
          onCancel={() => setScannedToolId(null)}
        />
      )}
    </div>
  )
}

// 扫码确认对话框组件
interface ScanConfirmModalProps {
  toolId: string
  items: any[]
  onConfirm: (status: ToolStatus, notes?: string) => void
  onCancel: () => void
}

function ScanConfirmModal({ onConfirm, onCancel }: ScanConfirmModalProps) {
  const { t } = useTranslation()
  const [selectedStatus, setSelectedStatus] = useState<ToolStatus>('available')
  const [notes, setNotes] = useState('')
  
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-medium text-gray-800 mb-4">{t('inventory.confirmScan')}</h3>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-700 mb-1">{t('tool.status')}</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as ToolStatus)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              {Object.entries(TOOL_STATUS).map(([key, value]) => (
                <option key={key} value={key}>
                  {t(value.labelKey)}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm text-gray-700 mb-1">{t('common.notes')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              rows={2}
              placeholder="备注说明..."
            />
          </div>
        </div>
        
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => onConfirm(selectedStatus, notes)}
            className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            {t('common.confirm')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
