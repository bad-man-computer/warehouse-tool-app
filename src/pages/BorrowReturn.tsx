import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ScanLine } from 'lucide-react'
import { useWarehouseStore } from '@/stores/warehouseStore'
import { useAuthStore } from '@/stores/authStore'
import { useTools } from '@/hooks/useTools'
import { useBorrowRecords, useOpenBorrowByToolId } from '@/hooks/useBorrowRecords'
import { useToolByCode } from '@/hooks/useTools'
import { canTransition } from '@/constants/toolStatus'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatDateTime, overdueDays, addDays } from '@/utils/format'
import { TOOL_STATUS } from '@/constants/toolStatus'
import type { Tool } from '@/types'
import QrScannerModal from '@/components/QrScannerModal'

const HAS_CAMERA =
  typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

export default function BorrowReturn() {
  const { t, i18n } = useTranslation()
  const currentId = useWarehouseStore((s) => s.currentId)
  const user = useAuthStore((s) => s.user)

  const [mode, setMode] = useState<'list' | 'borrow' | 'return'>('list')
  const location = useLocation()
  const [returnCode, setReturnCode] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [borrowerName, setBorrowerName] = useState('')
  const [department, setDepartment] = useState('')
  const [contact, setContact] = useState('')
  const [expectedReturnAt, setExpectedReturnAt] = useState(addDays(7))
  const [returnStatus, setReturnStatus] = useState<'normal' | 'damaged'>('normal')
  const [submitting, setSubmitting] = useState(false)

  // Scanner modal state: null = closed, 'borrow' = scanning to select tool, 'return' = scanning to return
  const [scannerMode, setScannerMode] = useState<'borrow' | 'return' | null>(null)

  const { tools: availableTools, loading: loadingAvailable, refetch: refetchTools } = useTools({
    warehouseId: currentId,
    status: 'available',
    search: '',
  })
  const { records: borrowedList, loading: loadingBorrowed, refetch: refetchBorrowed } = useBorrowRecords(currentId, true)
  const { tool: returnTool, loading: loadingReturnTool, refetch: refetchReturnTool } = useToolByCode(currentId, returnCode.trim() || null)
  const { record: openRecord } = useOpenBorrowByToolId(returnTool?.id ?? null)

  useEffect(() => {
    const state = location.state as { returnCode?: string; assetCode?: string } | null
    if (state?.returnCode) {
      setReturnCode(state.returnCode)
      setMode('return')
    }
    if (state?.assetCode) setMode('borrow')
  }, [location.state])

  const nameKey = i18n.language === 'en' ? 'name_en' : 'name_zh'

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === availableTools.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(availableTools.map((t) => t.id)))
  }

  /** Handle QR scan result based on current scanner mode */
  const handleScanResult = (code: string) => {
    if (scannerMode === 'return') {
      setReturnCode(code)
      // useToolByCode will auto-refetch when returnCode changes on re-render
    } else if (scannerMode === 'borrow') {
      const found = availableTools.find(
        (tool) => tool.asset_code === code || tool.id === code
      )
      if (found) {
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.add(found.id)
          return next
        })
        toast.success(`${found.asset_code} ${t('borrow.selected')}`)
      } else {
        toast.error(`${t('scan.notFound')}: ${code}`)
      }
    }
    setScannerMode(null)
  }

  const handleBorrow = async () => {
    if (!borrowerName.trim()) {
      toast.error(t('borrow.borrowerName') + ' ' + t('common.required'))
      return
    }
    const ids = Array.from(selectedIds)
    if (ids.length === 0) {
      toast.error(t('borrow.selectTools'))
      return
    }
    if (!currentId || !supabase || !isSupabaseConfigured()) {
      toast.error('Supabase not configured')
      return
    }
    const operatorId = user?.id ?? null
    setSubmitting(true)
    try {
      for (const toolId of ids) {
        const tool = availableTools.find((t) => t.id === toolId)
        if (!tool || !canTransition(tool.status, 'borrowed')) {
          toast.error(`Tool ${tool?.asset_code} cannot be borrowed`)
          continue
        }
        const { error: errRecord } = await supabase.from('borrow_records').insert({
          tool_id: toolId,
          operator_id: operatorId,
          borrower_name: borrowerName.trim(),
          department: department.trim(),
          contact: contact.trim(),
          expected_return_at: new Date(expectedReturnAt).toISOString(),
        })
        if (errRecord) throw new Error(errRecord.message)
        const { error: errTool } = await supabase.from('tools').update({ status: 'borrowed' }).eq('id', toolId)
        if (errTool) throw new Error(errTool.message)
      }
      toast.success(t('common.success'))
      setMode('list')
      setSelectedIds(new Set())
      setBorrowerName('')
      refetchTools()
      refetchBorrowed()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const handleReturn = async () => {
    if (!returnTool || !openRecord) {
      toast.error(t('borrow.returnCheck'))
      return
    }
    if (!canTransition(returnTool.status, 'returned')) {
      toast.error('Invalid status for return')
      return
    }
    if (!supabase || !isSupabaseConfigured()) {
      toast.error('Supabase not configured')
      return
    }
    setSubmitting(true)
    try {
      const now = new Date().toISOString()
      await supabase
        .from('borrow_records')
        .update({ actual_return_at: now, return_status: returnStatus })
        .eq('id', openRecord.id)
      const nextStatus = returnStatus === 'normal' ? 'available' : 'damaged'
      await supabase.from('tools').update({ status: nextStatus }).eq('id', returnTool.id)
      toast.success(t('common.success'))
      setReturnCode('')
      setReturnStatus('normal')
      refetchReturnTool()
      refetchTools()
      refetchBorrowed()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">{t('nav.borrow')}</h1>

      {/* Mode tabs */}
      <div className="flex flex-wrap gap-2">
        {(['list', 'borrow', 'return'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === m ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {m === 'list' && t('borrow.currentBorrowed')}
            {m === 'borrow' && t('borrow.borrowOut')}
            {m === 'return' && t('borrow.return')}
          </button>
        ))}
      </div>

      {/* LIST mode */}
      {mode === 'list' && (
        <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <h2 className="px-4 py-3 font-medium text-gray-800 border-b">{t('borrow.currentBorrowed')}</h2>
          {loadingBorrowed ? (
            <div className="p-8 text-center text-gray-500">{t('common.loading')}</div>
          ) : borrowedList.length === 0 ? (
            <div className="p-8 text-center text-gray-500">{t('borrow.noAvailableTools')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('tool.assetCode')}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('tool.name')}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('borrow.borrowerName')}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('borrow.expectedReturn')}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('borrow.overdue')}</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {borrowedList.map((r) => {
                    const days = overdueDays(r.expected_return_at)
                    return (
                      <tr key={r.id} className={days > 0 ? 'bg-red-50' : ''}>
                        <td className="px-4 py-2 text-sm font-mono">{(r.tool as Tool)?.asset_code ?? '—'}</td>
                        <td className="px-4 py-2 text-sm">{(r.tool as Tool)?.[nameKey] ?? '—'}</td>
                        <td className="px-4 py-2 text-sm">{r.borrower_name}</td>
                        <td className="px-4 py-2 text-sm">{formatDateTime(r.expected_return_at)}</td>
                        <td className="px-4 py-2 text-sm">{days > 0 ? t('borrow.overdueDays', { count: days }) : '—'}</td>
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() => {
                              setReturnCode((r.tool as Tool)?.asset_code ?? '')
                              setMode('return')
                            }}
                            className="text-primary-600 text-sm font-medium hover:underline"
                          >
                            {t('borrow.quickReturn')}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* BORROW mode */}
      {mode === 'borrow' && (
        <section className="bg-white rounded-lg border border-gray-200 p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-gray-800">{t('borrow.batchBorrow')}</h2>
            {HAS_CAMERA && (
              <button
                type="button"
                onClick={() => setScannerMode('borrow')}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                <ScanLine size={14} className="text-gray-600" />
                {t('scan.scanToBorrow')}
              </button>
            )}
          </div>

          {loadingAvailable ? (
            <p className="text-gray-500">{t('common.loading')}</p>
          ) : availableTools.length === 0 ? (
            <p className="text-gray-500">{t('borrow.noAvailableTools')}</p>
          ) : (
            <>
              <div className="mb-3">
                <button type="button" onClick={selectAll} className="text-sm text-primary-600 hover:underline">
                  {selectedIds.size === availableTools.length ? t('borrow.deselectAll') : t('borrow.selectAll')}
                </button>
                {selectedIds.size > 0 && (
                  <span className="ml-2 text-sm text-gray-500">
                    {t('borrow.selectedCount', { count: selectedIds.size })}
                  </span>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg mb-4">
                <table className="min-w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-8" />
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">{t('tool.assetCode')}</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">{t('tool.name')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableTools.map((tool) => (
                      <tr
                        key={tool.id}
                        className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleSelect(tool.id)}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(tool.id)}
                            onChange={() => toggleSelect(tool.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-3 py-2 text-sm font-mono">{tool.asset_code}</td>
                        <td className="px-3 py-2 text-sm">{tool[nameKey]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('borrow.borrowerName')} *</label>
                  <input
                    type="text"
                    value={borrowerName}
                    onChange={(e) => setBorrowerName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('borrow.department')}</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('borrow.contact')}</label>
                  <input
                    type="text"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('borrow.expectedReturn')}</label>
                  <input
                    type="datetime-local"
                    value={expectedReturnAt}
                    onChange={(e) => setExpectedReturnAt(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleBorrow}
                  disabled={submitting || selectedIds.size === 0}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary-700 transition-colors"
                >
                  {submitting ? t('common.loading') : t('borrow.confirmBorrow')}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* RETURN mode */}
      {mode === 'return' && (
        <section className="bg-white rounded-lg border border-gray-200 p-4 md:p-6">
          <h2 className="font-medium text-gray-800 mb-4">{t('borrow.returnByCode')}</h2>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={returnCode}
              onChange={(e) => setReturnCode(e.target.value)}
              onBlur={() => returnCode.trim() && refetchReturnTool()}
              onKeyDown={(e) => e.key === 'Enter' && refetchReturnTool()}
              placeholder={t('tool.assetCode')}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              type="button"
              onClick={() => refetchReturnTool()}
              className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 transition-colors"
            >
              {t('common.search')}
            </button>
            {HAS_CAMERA && (
              <button
                type="button"
                onClick={() => setScannerMode('return')}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                title={t('scan.scanToReturn')}
              >
                <ScanLine size={16} className="text-gray-600" />
                <span className="hidden sm:inline">{t('scan.scanToReturn')}</span>
              </button>
            )}
          </div>

          {loadingReturnTool && returnCode.trim() && (
            <p className="text-gray-500 text-sm">{t('common.loading')}</p>
          )}

          {returnCode.trim() && !loadingReturnTool && returnTool && (
            <div className="border border-gray-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="font-mono font-semibold text-gray-800">{returnTool.asset_code}</p>
                  <p className="text-sm text-gray-700 mt-0.5">{returnTool[nameKey]}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {t('tool.status')}: {t(TOOL_STATUS[returnTool.status].labelKey)}
                  </p>
                </div>
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${TOOL_STATUS[returnTool.status].color}`}>
                  {t(TOOL_STATUS[returnTool.status].labelKey)}
                </span>
              </div>

              {openRecord && (
                <>
                  <p className="text-sm text-gray-600 mt-3">
                    {t('borrow.borrowerName')}: <strong>{openRecord.borrower_name}</strong>
                    {' | '}
                    {t('borrow.expectedReturn')}: {formatDateTime(openRecord.expected_return_at)}
                  </p>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('borrow.returnStatus')}
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={returnStatus === 'normal'}
                          onChange={() => setReturnStatus('normal')}
                        />
                        <span className="text-sm">{t('borrow.normal')}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={returnStatus === 'damaged'}
                          onChange={() => setReturnStatus('damaged')}
                        />
                        <span className="text-sm">{t('borrow.damaged')}</span>
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={handleReturn}
                      disabled={submitting}
                      className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary-700 transition-colors"
                    >
                      {submitting ? t('common.loading') : t('borrow.confirmReturn')}
                    </button>
                  </div>
                </>
              )}
              {!openRecord && returnTool.status === 'borrowed' && (
                <p className="text-amber-600 text-sm mt-2">{t('borrow.noOpenRecord')}</p>
              )}
              {returnTool.status !== 'borrowed' && (
                <p className="text-gray-500 text-sm mt-2">{t('borrow.notBorrowed')}</p>
              )}
            </div>
          )}

          {returnCode.trim() && !loadingReturnTool && !returnTool && (
            <p className="text-gray-500 text-sm">{t('scan.notFound')}</p>
          )}
        </section>
      )}

      {/* QR Scanner Modal */}
      <QrScannerModal
        isOpen={scannerMode !== null}
        onClose={() => setScannerMode(null)}
        onScan={handleScanResult}
      />
    </div>
  )
}
