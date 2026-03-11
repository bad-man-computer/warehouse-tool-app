import { useMemo, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Plus, Printer, Download, QrCode, X, Copy, Check } from 'lucide-react'
import { useWarehouseStore } from '@/stores/warehouseStore'
import { useAuthStore } from '@/stores/authStore'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { TOOL_STATUS } from '@/constants/toolStatus'
import type { Tool } from '@/types'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - QRCode module declaration exists in types/qrcode.d.ts
import QRCode from 'qrcode'
import { useCategories } from '@/hooks/useCategories'

export default function ToolList() {
  const { t, i18n } = useTranslation()
  const currentId = useWarehouseStore((s) => s.currentId)
  const user= useAuthStore((s) => s.user)
  const canAdd = user?.role === 'admin' || user?.role === 'warehouse_manager'

  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showQr, setShowQr] = useState<Tool | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [selectedForPrint, setSelectedForPrint] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)
  const [generatedAssetCode, setGeneratedAssetCode] = useState(false)

  // Form state
  const [assetCode, setAssetCode] = useState('')
  const [nameZh, setNameZh] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [locationZh, setLocationZh] = useState('')
  const [locationEn, setLocationEn] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [manualCategory, setManualCategory] = useState(false)
  const [purchaseInfo, setPurchaseInfo] = useState('')
  const [status, setStatus] = useState<string>('available')
  const [model, setModel] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [remarks, setRemarks] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [formQrDataUrl, setFormQrDataUrl] = useState<string>('')

  const { categories } = useCategories(currentId)

  // Generate live QR preview when assetCode changes
  useEffect(() => {
    if (!assetCode.trim()) { setFormQrDataUrl(''); return }
    QRCode.toDataURL(assetCode.trim(), { margin: 1, width: 120 })
      .then(setFormQrDataUrl)
      .catch(() => setFormQrDataUrl(''))
  }, [assetCode])

  const loadTools = async () => {
    if (!isSupabaseConfigured() || !supabase || !currentId) {
      setTools([])
      return
    }
    setLoading(true)
    try {
      let q = supabase
        .from('tools')
        .select('*')
        .eq('warehouse_id', currentId)
        .is('deleted_at', null)
      if (filterStatus) q = q.eq('status', filterStatus)
      if (search) q = q.or(`asset_code.ilike.%${search}%,name_zh.ilike.%${search}%,name_en.ilike.%${search}%`)
     const { data } = await q.order('asset_code')
      setTools((data as Tool[]) ?? [])
    } catch (e) {
     console.error('Failed to load tools', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTools()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, filterStatus, search])

  const nameKey = i18n.language === 'en' ? 'name_en' : 'name_zh'
  const locationKey = i18n.language === 'en' ? 'location_en' : 'location_zh'
  const selectedTools = useMemo(() => tools.filter((t) => selectedForPrint.has(t.id)), [tools, selectedForPrint])

  const resetForm = () => {
    setAssetCode('')
    setNameZh('')
    setNameEn('')
    setLocationZh('')
    setLocationEn('')
    setCategoryId('')
    setManualCategory(false)
    setPurchaseInfo('')
    setStatus('available')
    setModel('')
    setQuantity(1)
    setRemarks('')
    setPurchaseDate('')
    setFormQrDataUrl('')
    setCopied(false)
    setGeneratedAssetCode(false)
  }

  const generateAssetCode = async () => {
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    const code = `TL-${timestamp}-${random}`
    setAssetCode(code)
    setGeneratedAssetCode(true)
    
    try {
      const url = await QRCode.toDataURL(code, { margin: 1, width: 200 })
      setFormQrDataUrl(url)
      toast.success(t('tool.codeGenerated'))
    } catch (e) {
      console.error('Failed to generate QR code', e)
      toast.error(t('tool.codeGenerated'))
    }
  }

  const handleCopyCode = async () => {
    if (!assetCode.trim()) return
    
    try {
      await navigator.clipboard.writeText(assetCode)
      setCopied(true)
      toast.success(t('common.copied'))
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      toast.error(t('common.copyFailed'))
    }
  }

  const handleAdd = async () => {
  if (!canAdd) { toast.error('No permission'); return }
  if (!currentId) { toast.error('请选择仓库'); return }
  if (!supabase || !isSupabaseConfigured()) { toast.error('Supabase not configured'); return }

  const resolvedCategoryId = (categoryId || categories[0]?.id || '').trim()
  if (!assetCode.trim() || !nameZh.trim() || !nameEn.trim() || !resolvedCategoryId) {
      toast.error(t('common.required'))
      return
    }
    setSubmitting(true)
    try {
   const { error } = await supabase.from('tools').insert({
        warehouse_id: currentId,
        asset_code: assetCode.trim(),
        name_zh: nameZh.trim(),
        name_en: nameEn.trim(),
        category_id: resolvedCategoryId,
        location_zh: locationZh.trim(),
        location_en: locationEn.trim(),
        status,
        purchase_info: purchaseInfo.trim() || null,
     qr_code: assetCode.trim(),
      model: model.trim() || null,
     quantity: quantity,
      remarks: remarks.trim() || null,
      purchase_date: purchaseDate || null,
      })
   if (error) { toast.error(error.message); return }
      
      // 记录库存历史
   const { data: insertedTool } = await supabase
        .from('tools')
        .select('id')
        .eq('asset_code', assetCode.trim())
       .single()
      
   if (insertedTool) {
        await supabase.from('tool_inventory_history').insert({
          tool_id: insertedTool.id,
         warehouse_id: currentId,
       quantity_before: 0,
       quantity_after: quantity,
       operation: 'add',
       operator_id: user?.id ?? null,
       notes: remarks.trim() || 'Initial tool creation',
        })
      }
      
      toast.success(t('common.success'))
      setShowAdd(false)
      resetForm()
      loadTools()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const openQr = async (tool: Tool) => {
  const value = tool.qr_code || tool.asset_code
    try {
    const url = await QRCode.toDataURL(value, { margin: 1, width: 240 })
      setQrDataUrl(url)
      setShowQr(tool)
    } catch (e) {
      toast.error(String(e))
    }
  }

  const togglePrintSelect = (toolId: string) => {
    setSelectedForPrint((prev) => {
      const next = new Set(prev)
      if (next.has(toolId)) next.delete(toolId)
      else next.add(toolId)
      return next
    })
  }

  const generateQrLabels = async (list: Tool[]) => {
    return await Promise.all(
      list.map(async (tool) => {
      const value = tool.qr_code || tool.asset_code
      const url = await QRCode.toDataURL(value, { margin: 0, width: 180 })
      const title = i18n.language === 'en' ? tool.name_en : tool.name_zh
        return {
        qrUrl: url,
        code: tool.asset_code,
          name: title ?? '',
        }
      })
    )
  }

  const printLabels = async (list: Tool[]) => {
  if (list.length === 0) return
  const labels = await generateQrLabels(list)
  const w = window.open('', '_blank', 'width=800,height=600')
  if (!w) { toast.error('Popup blocked'); return }
    w.document.open()
    w.document.write(`
      <html>
        <head>
          <title>QR Labels</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 12px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
            .label { border: 1px solid #ddd; border-radius: 8px; padding: 10px; text-align: center; }
            .label img { width: 120px; height: 120px; image-rendering: pixelated; }
            .code { margin-top: 6px; font-weight: 700; font-family: ui-monospace, Menlo, monospace; }
            .name { margin-top: 2px; font-size: 12px; color: #333; }
            @media print { body { margin: 0; } .label { page-break-inside: avoid; } }
          </style>
        </head>
        <body>
          <div class="grid">${labels.map(l => `
            <div class="label">
              <img src="${l.qrUrl}" alt="qr" />
              <div class="code">${l.code}</div>
              <div class="name">${l.name}</div>
            </div>
          `).join('')}</div>
          <script>window.onload = () => { window.print(); };<\/script>
        </body>
      </html>`)
    w.document.close()
  }

  const downloadQrCodes = async (list: Tool[]) => {
  if (list.length === 0) return
    try {
    const labels = await generateQrLabels(list)
      
      for (const label of labels) {
      const link = document.createElement('a')
        link.href = label.qrUrl
        link.download = `QR_${label.code}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        // 避免浏览器限制，添加小延迟
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      toast.success(t('common.success'))
    } catch (e) {
      toast.error(String(e))
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with manual entry hint */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">{t('nav.tools')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('tool.manualEntryHint')}
          </p>
        </div>
        <div className="flex gap-2">
          {selectedForPrint.size > 0 && (
            <>
              <button
            type="button"
                onClick={() => downloadQrCodes(selectedTools)}
                className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <Download size={15} />
                {t('tool.batchDownloadQr')} ({selectedForPrint.size})
              </button>
              <button
            type="button"
                onClick={() => printLabels(selectedTools)}
                className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <Printer size={15} />
                {t('tool.batchPrintQr')} ({selectedForPrint.size})
              </button>
            </>
          )}
          {canAdd && (
            <button
          type="button"
              onClick={() => {
            if (!currentId) { toast.error(t('tool.selectWarehouseFirst')); return }
                setShowAdd(true)
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              <Plus size={15} />
              {t('tool.addTool')}
            </button>
          )}
        </div>
      </div>

      {/* Guidance banners */}
      {!currentId && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <span className="text-amber-500 text-lg leading-none mt-0.5">⚠</span>
          <p className="text-sm text-amber-800">{t('tool.selectWarehouseFirst')}</p>
        </div>
      )}
      {currentId && !canAdd && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <span className="text-blue-500 text-lg leading-none mt-0.5">ℹ</span>
          <p className="text-sm text-blue-800">{t('tool.noAddPermission')}</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder={t('common.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">{t('tool.status')}</option>
          {Object.entries(TOOL_STATUS).map(([s, { labelKey }]) => (
            <option key={s} value={s}>{t(labelKey)}</option>
          ))}
        </select>
      </div>

      {/* Add Tool Modal */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => { setShowAdd(false); resetForm() }}
        >
          <div
            className="bg-white rounded-xl w-full max-w-2xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Plus size={18} className="text-primary-600" />
                <h2 className="text-base font-semibold text-gray-800">{t('tool.addTool')}</h2>
              </div>
              <button
            type="button"
                onClick={() => { setShowAdd(false); resetForm() }}
                className="p-1 rounded-md hover:bg-gray-100 transition-colors"
              >
                <X size={18} className="text-gray-600" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="space-y-4">
                {/* Asset code with generator */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm text-gray-700">{t('tool.assetCode')} *</label>
                    <button
                     type="button"
                      onClick={generateAssetCode}
                      className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                    >
                      <QrCode size={14} />
                      {t('tool.autoGenerateCode')}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        value={assetCode}
                        onChange={(e) => setAssetCode(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                        placeholder="e.g. TL-0001 or scan to auto-fill"
                      />
                    </div>
                    <button
                     type="button"
                      onClick={handleCopyCode}
                      disabled={!assetCode.trim()}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                      title={t('common.copy')}
                    >
                      {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                    </button>
                  </div>
                  {generatedAssetCode && (
                    <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                      <Check size={12} />
                      {t('tool.codeAutoGenerated')}
                    </p>
                  )}
                </div>

                {/* Live QR preview */}
                {formQrDataUrl && (
                  <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                    <p className="text-xs text-gray-600 mb-2">{t('tool.qrPreview')}</p>
                    <div className="flex items-center gap-4">
                      <img src={formQrDataUrl} alt="QR preview" className="w-32 h-32" />
                      <div className="flex-1">
                        <p className="text-sm font-mono text-gray-700 break-all">{assetCode}</p>
                        <p className="text-xs text-gray-500 mt-1">{t('tool.scanToOperate')}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Basic info */}
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">{t('tool.name')} (中文) *</label>
                    <input
                      value={nameZh}
                      onChange={(e) => setNameZh(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">{t('tool.name')} (English) *</label>
                    <input
                      value={nameEn}
                      onChange={(e) => setNameEn(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">{t('tool.status')}</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {Object.entries(TOOL_STATUS).map(([s, meta]) => (
                        <option key={s} value={s}>{t(meta.labelKey)}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1">{t('tool.model')}</label>
                    <input
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder={t('tool.modelPlaceholder')}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1">{t('tool.quantity')}</label>
                    <input
                     type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1">{t('tool.purchaseDate')}</label>
                    <input
                     type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1">{t('tool.location')} (中文)</label>
                    <input
                      value={locationZh}
                      onChange={(e) => setLocationZh(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">{t('tool.location')} (English)</label>
                    <input
                      value={locationEn}
                      onChange={(e) => setLocationEn(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm text-gray-700">{t('tool.category')} *</label>
                      <label className="text-xs text-gray-400 flex items-center gap-1.5 cursor-pointer">
                        <input
                      type="checkbox"
                          checked={manualCategory}
                          onChange={() => setManualCategory((v) => !v)}
                          className="rounded"
                        />
                        {t('scan.manualInput')}
                      </label>
                    </div>
                    {!manualCategory ? (
                      <select
                        value={categoryId || (categories[0]?.id ?? '')}
                        onChange={(e) => setCategoryId(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={categories.length === 0}
                      >
                        {categories.length === 0 ? (
                          <option value="">{t('tool.noCategories')}</option>
                        ) : (
                          <>
                            <option value="">{t('tool.selectCategory')}</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {(i18n.language === 'en' ? c.name_en : c.name_zh) || c.id}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    ) : (
                      <input
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="UUID (tool_categories.id)"
                      />
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-700 mb-1">{t('tool.purchaseInfo')}</label>
                    <input
                      value={purchaseInfo}
                      onChange={(e) => setPurchaseInfo(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-700 mb-1">{t('tool.remarks')}</label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows={3}
                      placeholder={t('tool.remarksPlaceholder')}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-2 justify-end bg-gray-50">
              <button
             type="button"
                onClick={() => { setShowAdd(false); resetForm() }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
             type="button"
                disabled={submitting}
                onClick={handleAdd}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary-700 transition-colors"
              >
                <Plus size={14} />
                {submitting ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tool list table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">{t('common.loading')}</div>
        ) : tools.length === 0 ? (
          <div className="p-8 text-center text-gray-500">{t('common.noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-8" />
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('tool.assetCode')}</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('tool.name')}</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('tool.location')}</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('tool.status')}</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('tool.qrCode')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tools.map((tool) => (
                  <tr key={tool.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedForPrint.has(tool.id)}
                        onChange={() => togglePrintSelect(tool.id)}
                      />
                    </td>
                    <td className="px-4 py-2 text-sm font-mono text-gray-800">{tool.asset_code}</td>
                    <td className="px-4 py-2 text-sm">{tool[nameKey]}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{tool[locationKey]}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${TOOL_STATUS[tool.status].color}`}>
                        {t(TOOL_STATUS[tool.status].labelKey)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm space-x-2">
                      <button
                     type="button"
                        className="text-primary-600 hover:underline text-xs"
                        onClick={() => openQr(tool)}
                      >
                        {t('tool.showQr')}
                      </button>
                      <button
                     type="button"
                        className="text-gray-500 hover:underline text-xs"
                        onClick={() => downloadQrCodes([tool])}
                      >
                        {t('tool.downloadQr')}
                      </button>
                      <button
                     type="button"
                        className="text-gray-500 hover:underline text-xs"
                        onClick={() => printLabels([tool])}
                      >
                        {t('tool.printQr')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QR View Modal */}
      {showQr && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowQr(null)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-xs p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-800">{showQr.asset_code}</h3>
                <p className="text-sm text-gray-500">{showQr[nameKey]}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowQr(null)}
                className="p-1 rounded-md hover:bg-gray-100"
              >
                <X size={18} className="text-gray-600" />
              </button>
            </div>
            <div className="flex items-center justify-center py-4 bg-gray-50 rounded-lg">
              {qrDataUrl
                ? <img src={qrDataUrl} alt="qr" className="w-48 h-48" />
                : <div className="text-gray-400 text-sm">{t('common.loading')}</div>
              }
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button
             type="button"
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                onClick={() => downloadQrCodes([showQr])}
              >
                <Download size={14} />
                {t('tool.downloadQr')}
              </button>
              <button
             type="button"
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                onClick={() => printLabels([showQr])}
              >
                <Printer size={14} />
                {t('tool.printQr')}
              </button>
              <button
             type="button"
                className="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                onClick={() => setShowQr(null)}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
