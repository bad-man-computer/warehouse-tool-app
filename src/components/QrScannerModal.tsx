import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Camera } from 'lucide-react'

interface QrScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onScan: (code: string) => void
}

export default function QrScannerModal({ isOpen, onClose, onScan }: QrScannerModalProps) {
  const { t } = useTranslation()
  const html5QrRef = useRef<{ stop?: () => Promise<void>; isScanning?: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const stopScanner = async () => {
    const qr = html5QrRef.current
    if (qr?.stop && qr?.isScanning) {
      try {
        await qr.stop()
      } catch {
        /* ignore */
      }
    }
    html5QrRef.current = null
  }

  useEffect(() => {
    if (!isOpen) return
    setError(null)

    // Small delay to ensure the DOM element is mounted before initialising
    const timer = setTimeout(() => {
      import('html5-qrcode').then(({ Html5Qrcode }) => {
        if (!document.getElementById('qr-scanner-reader')) return
        const html5Qr = new Html5Qrcode('qr-scanner-reader')
        html5QrRef.current = html5Qr as typeof html5QrRef.current
        html5Qr
          .start(
            { facingMode: 'environment' },
            { fps: 5, qrbox: { width: 200, height: 200 } },
            (decodedText: string) => {
              onScan(decodedText.trim())
              stopScanner()
              onClose()
            },
            () => {}
          )
          .catch((err: Error) => {
            setError(err.message || t('scan.cameraError'))
          })
      })
    }, 150)

    return () => {
      clearTimeout(timer)
      stopScanner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-sm overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-primary-600" />
            <h3 className="font-medium text-gray-800">{t('scan.cameraTitle')}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X size={18} className="text-gray-600" />
          </button>
        </div>

        {/* Camera viewport */}
        <div className="relative bg-black" style={{ minHeight: 280 }}>
          <div id="qr-scanner-reader" className="w-full" />
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center px-6">
                <Camera size={36} className="text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-red-600 font-medium">{t('scan.cameraError')}</p>
                <p className="text-xs text-gray-500 mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Tip */}
        <div className="px-4 py-3 text-center text-sm text-gray-500 bg-gray-50">
          {t('scan.cameraTip')}
        </div>
      </div>
    </div>
  )
}
