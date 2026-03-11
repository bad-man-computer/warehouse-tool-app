import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { useWarehouseStore } from '@/stores/warehouseStore'
import { useTools } from '@/hooks/useTools'
import { useRepairs, useRepairHistory, type RepairRecordWithTool } from '@/hooks/useRepairs'
import { canTransition } from '@/constants/toolStatus'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatDate } from '@/utils/format'
import type { Tool } from '@/types'

type RepairTab = 'repairing' | 'damaged' | 'completed'

export default function Repair() {
  const { t, i18n } = useTranslation()
  const currentId = useWarehouseStore((s) => s.currentId)

  const [tab, setTab] = useState<RepairTab>('repairing')
  const [sendModal, setSendModal] = useState<Tool | null>(null)
  const [completeModal, setCompleteModal] = useState<RepairRecordWithTool | null>(null)
  const [historyToolId, setHistoryToolId] = useState<string | null>(null)

  const [desc, setDesc] = useState('')
  const [vendor, setVendor] = useState('')
  const [cost, setCost] = useState('')
  const [sentAt, setSentAt] = useState(new Date().toISOString().slice(0, 10))
  const [completeCost, setCompleteCost] = useState('')
  const [completeDate, setCompleteDate] = useState(new Date().toISOString().slice(0, 10))
  const [result, setResult] = useState<'repaired' | 'scrapped'>('repaired')
  const [submitting, setSubmitting] = useState(false)

  const { tools: damagedTools } = useTools({ warehouseId: currentId, status: 'damaged' })
  const { records: repairingRecords, loading: loadingRepairing, refetch: refRepairing } = useRepairs(currentId, 'repairing')
  const { records: completedRecords, loading: loadingCompleted, refetch: refCompleted } = useRepairs(currentId, 'completed')
  const { records: historyRecords, loading: loadingHistory } = useRepairHistory(historyToolId)

  const nameKey = i18n.language === 'en' ? 'name_en' : 'name_zh'

  const handleSendRepair = async () => {
    if (!sendModal || !currentId || !supabase || !isSupabaseConfigured()) return
    if (!canTransition('damaged', 'repairing')) return
    setSubmitting(true)
    try {
      const { data: existing } = await supabase
        .from('repair_records')
        .select('id')
        .eq('tool_id', sendModal.id)
        .is('result', null)
        .order('reported_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const payload = {
        tool_id: sendModal.id,
        reported_at: new Date().toISOString(),
        description_zh: desc.trim() || null,
        sent_at: new Date(sentAt).toISOString(),
        vendor: vendor.trim() || null,
        cost: cost ? Number(cost) : null,
        expected_complete_at: null,
      }
      if (existing?.id) {
        await supabase.from('repair_records').update(payload).eq('id', existing.id)
      } else {
        await supabase.from('repair_records').insert(payload)
      }
      await supabase.from('tools').update({ status: 'repairing' }).eq('id', sendModal.id)
      toast.success(t('common.success'))
      setSendModal(null)
      setDesc('')
      setVendor('')
      setCost('')
      refRepairing()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const handleCompleteRepair = async () => {
    if (!completeModal || !supabase || !isSupabaseConfigured()) return
    const tool = completeModal.tool
    if (!tool) return
    const nextStatus = result === 'repaired' ? 'available' : 'lost'
    
    // 检查状态转换是否允许
    if (!canTransition('repairing', nextStatus)) {
      toast.error(`无法完成维修：状态不能从 'repairing' 转换为 '${nextStatus}'`)
      return
    }
    
    setSubmitting(true)
    try {
      // 更新维修记录
      const { error: updateError } = await supabase!
        .from('repair_records')
        .update({
          completed_at: new Date(completeDate).toISOString(),
          cost: completeCost ? Number(completeCost) : completeModal.cost,
          result,
        })
        .eq('id', completeModal.id)
      
      if (updateError) {
        toast.error('更新维修记录失败：' + updateError.message)
        return
      }
      
      // 更新工具状态
      const { error: statusError } = await supabase!
        .from('tools')
        .update({ status: nextStatus })
        .eq('id', tool.id)
      
      if (statusError) {
        toast.error('更新工具状态失败：' + statusError.message)
        return
      }
      
      toast.success(t('common.success'))
      setCompleteModal(null)
      setResult('repaired')
      refRepairing()
      refCompleted()
    } catch (e) {
      console.error('完成维修失败:', e)
      toast.error('操作失败：' + String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">{t('nav.repair')}</h1>

      <div className="flex gap-2 border-b">
        {(['repairing', 'damaged', 'completed'] as RepairTab[]).map((tabs) => (
          <button
            key={tabs}
            type="button"
            onClick={() => setTab(tabs)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === tabs ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}
          >
            {tabs === 'repairing' ? t('repair.repairing') : tabs === 'damaged' ? t('repair.pendingRepair') : t('repair.completed')}
          </button>
        ))}
      </div>

      {tab === 'repairing' && (
        <section className="bg-white rounded-lg border overflow-hidden">
          {loadingRepairing ? (
            <div className="p-8 text-center text-gray-500">{t('common.loading')}</div>
          ) : repairingRecords.length === 0 ? (
            <div className="p-8 text-center text-gray-500">暂无维修中记录</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('tool.assetCode')}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('tool.name')}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('repair.description')}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('repair.sentDate')}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('repair.vendor')}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {repairingRecords.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2 text-sm font-mono">{(r.tool as Tool)?.asset_code}</td>
                      <td className="px-4 py-2 text-sm">{(r.tool as Tool)?.[nameKey]}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{r.description_zh ?? r.description_en ?? '—'}</td>
                      <td className="px-4 py-2 text-sm">{r.sent_at ? formatDate(r.sent_at) : '—'}</td>
                      <td className="px-4 py-2 text-sm">{r.vendor ?? '—'}</td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => setCompleteModal(r)}
                          className="text-primary-600 text-sm hover:underline"
                        >
                          {t('repair.completeRepairForm')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoryToolId(r.tool_id)}
                          className="ml-2 text-gray-500 text-sm hover:underline"
                        >
                          {t('repair.repairHistory')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'damaged' && (
        <section className="bg-white rounded-lg border overflow-hidden">
          {damagedTools.length === 0 ? (
            <div className="p-8 text-center text-gray-500">暂无待维修工具</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('tool.assetCode')}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('tool.name')}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {damagedTools.map((tool) => (
                    <tr key={tool.id}>
                      <td className="px-4 py-2 text-sm font-mono">{tool.asset_code}</td>
                      <td className="px-4 py-2 text-sm">{tool[nameKey]}</td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => setSendModal(tool)}
                          className="text-primary-600 text-sm hover:underline"
                        >
                          {t('repair.sendRepairForm')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoryToolId(tool.id)}
                          className="ml-2 text-gray-500 text-sm hover:underline"
                        >
                          {t('repair.repairHistory')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'completed' && (
        <section className="bg-white rounded-lg border overflow-hidden">
          {loadingCompleted ? (
            <div className="p-8 text-center text-gray-500">{t('common.loading')}</div>
          ) : completedRecords.length === 0 ? (
            <div className="p-8 text-center text-gray-500">暂无已完成记录</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('tool.assetCode')}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('tool.name')}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('repair.result')}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('repair.completeDate')}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('repair.cost')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {completedRecords.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2 text-sm font-mono">{(r.tool as Tool)?.asset_code}</td>
                      <td className="px-4 py-2 text-sm">{(r.tool as Tool)?.[nameKey]}</td>
                      <td className="px-4 py-2 text-sm">{r.result === 'repaired' ? t('repair.repaired') : t('repair.scrapped')}</td>
                      <td className="px-4 py-2 text-sm">{r.completed_at ? formatDate(r.completed_at) : '—'}</td>
                      <td className="px-4 py-2 text-sm">{r.cost != null ? r.cost : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {sendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="font-medium text-gray-800 mb-4">{t('repair.sendRepairForm')} - {sendModal.asset_code}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">{t('repair.description')}</label>
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full border rounded-lg px-3 py-2" rows={2} />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">{t('repair.vendor')}</label>
                <input type="text" value={vendor} onChange={(e) => setVendor(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">{t('repair.cost')}</label>
                <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">{t('repair.sentDate')}</label>
                <input type="date" value={sentAt} onChange={(e) => setSentAt(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={handleSendRepair} disabled={submitting} className="px-4 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50">
                {submitting ? t('common.loading') : t('common.save')}
              </button>
              <button type="button" onClick={() => setSendModal(null)} className="px-4 py-2 border rounded-lg">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {completeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="font-medium text-gray-800 mb-4">{t('repair.completeRepairForm')} - {(completeModal.tool as Tool)?.asset_code}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">{t('repair.actualCost')}</label>
                <input type="number" value={completeCost} onChange={(e) => setCompleteCost(e.target.value)} placeholder={String(completeModal.cost ?? '')} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">{t('repair.completeDate')}</label>
                <input type="date" value={completeDate} onChange={(e) => setCompleteDate(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">{t('repair.result')}</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2"><input type="radio" checked={result === 'repaired'} onChange={() => setResult('repaired')} /> {t('repair.repaired')}</label>
                  <label className="flex items-center gap-2"><input type="radio" checked={result === 'scrapped'} onChange={() => setResult('scrapped')} /> {t('repair.scrapped')}</label>
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={handleCompleteRepair} disabled={submitting} className="px-4 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50">
                {submitting ? t('common.loading') : t('common.save')}
              </button>
              <button type="button" onClick={() => setCompleteModal(null)} className="px-4 py-2 border rounded-lg">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {historyToolId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setHistoryToolId(null)}>
          <div className="bg-white rounded-lg max-w-lg w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-medium text-gray-800 mb-4">{t('repair.repairHistory')}</h3>
            {loadingHistory ? <p className="text-gray-500">{t('common.loading')}</p> : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {historyRecords.map((r) => (
                  <li key={r.id} className="text-sm border-b pb-2">
                    <span className="text-gray-600">{formatDate(r.reported_at)}</span> — {r.description_zh ?? r.description_en ?? '—'} | {r.result ? (r.result === 'repaired' ? t('repair.repaired') : t('repair.scrapped')) : t('repair.repairing')}
                  </li>
                ))}
                {historyRecords.length === 0 && <p className="text-gray-500">无记录</p>}
              </ul>
            )}
            <button type="button" onClick={() => setHistoryToolId(null)} className="mt-4 px-4 py-2 border rounded-lg">{t('common.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
