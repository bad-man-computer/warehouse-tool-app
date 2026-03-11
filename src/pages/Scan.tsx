import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ScanLine, Search, ArrowLeftRight, Undo2, Plus } from 'lucide-react'
import { useWarehouseStore } from '@/stores/warehouseStore'
import { useAuthStore } from '@/stores/authStore'
import QrScannerModal from '@/components/QrScannerModal'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { toast } from '@/utils/toast'
import type { Tool } from '@/types'
import { TOOL_STATUS } from '@/constants/toolStatus'

const HAS_CAMERA = true

export default function Scan() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { currentId } = useWarehouseStore()
  const user = useAuthStore((s) => s.user)
  const canAdd = user?.role === 'admin' || user?.role === 'warehouse_manager'

  const [inputCode, setInputCode] = useState('')
  const [resolvedCode, setResolvedCode] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tool, setTool] = useState<Tool | null>(null)

  const handleScanResult = (code: string) => {
    setInputCode(code)
    setResolvedCode(code)
  }

  const handleSearch = async () => {
    const code = inputCode.trim()
    if (!code) return
    
    if (!currentId || !supabase || !isSupabaseConfigured()) {
      toast('Supabase not configured', 'error')
      return
    }
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tools')
        .select('*')
        .eq('warehouse_id', currentId)
        .eq('asset_code', code)
        .is('deleted_at', null)
        .single()
      
      if (error || !data) {
        setTool(null)
        toast(t('scan.notFound'), 'error')
      } else {
        setTool(data as Tool)
      }
    } catch (e) {
      setTool(null)
      toast(String(e), 'error')
    } finally {
      setLoading(false)
    }
  }

  const activeCode = resolvedCode || inputCode.trim()
  const nameKey = i18n.language === 'en' ? 'name_en' : 'name_zh'

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">{t('nav.scan')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('scan.description')}</p>
      </div>

      {/* Search / Scan input */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('tool.assetCode')}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <button
            type="button"
            onClick={handleSearch}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            {t('common.search')}
          </button>
          {HAS_CAMERA && (
            <button
              type="button"
                onClick={() => setScannerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                title={t('scan.openCamera')}
              >
                <ScanLine size={16} className="text-gray-600" />
                <span className="hidden sm:inline">{t('scan.openCamera')}</span>
              </button>
          )}
        </div>
      </div>

      {/* Result area */}
      {activeCode && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          {loading ? (
            <p className="text-gray-500 text-sm">{t('common.loading')}</p>
          ) : tool ? (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-base font-semibold text-gray-800">{tool.asset_code}</p>
                  <p className="text-gray-700 mt-0.5">{tool[nameKey]}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {t('tool.location')}: {i18n.language === 'en' ? tool.location_en : tool.location_zh}
                  </p>
                </div>
                <span
                  className={`inline-flex px-2 py-0.5 rounded text-xs font-medium shrink-0 ${TOOL_STATUS[tool.status].color}`}
                >
                  {t(TOOL_STATUS[tool.status].labelKey)}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                    onClick={() => navigate('/borrow', { state: { assetCode: tool.asset_code } })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                  >
                    <ArrowLeftRight size={14} />
                    {t('borrow.borrowOut')}
                  </button>
                <button
                  type="button"
                    onClick={() => navigate('/borrow', { state: { returnCode: tool.asset_code } })}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                  >
                    <Undo2 size={14} />
                    {t('borrow.return')}
                  </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-gray-500 text-sm">{t('scan.notFound')}</p>

              {canAdd && (
                <button
                  type="button"
                    onClick={() => navigate('/tools?action=add&code=' + encodeURIComponent(activeCode))}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-primary-400 text-primary-600 rounded-lg text-sm hover:bg-primary-50 transition-colors"
                  >
                    <Plus size={14} />
                    {t('scan.quickCreate')}
                  </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* QR Scanner Modal */}
      <QrScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScanResult}
      />
    </div>
  )
}