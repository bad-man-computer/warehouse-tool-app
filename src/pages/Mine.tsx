import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { useWarehouseStore } from '@/stores/warehouseStore'

export default function Mine() {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const setLanguage = useAuthStore((s) => s.setLanguage)
  const logout = useAuthStore((s) => s.logout)
  const { list, currentId, setCurrent } = useWarehouseStore()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">{t('nav.mine')}</h1>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold">
            {user?.username ? user.username.charAt(0).toUpperCase() : '?'}
          </div>
          <div>
            <p className="font-medium text-gray-800">{user?.username}</p>
            <p className="text-sm text-gray-500">{user?.role}</p>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          <div className="p-4">
            <p className="text-sm text-gray-500 mb-2">{t('common.language')}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setLanguage('zh'); i18n.changeLanguage('zh') }}
                className={`px-3 py-1.5 rounded-lg text-sm ${i18n.language === 'zh' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                {t('common.zh')}
              </button>
              <button
                type="button"
                onClick={() => { setLanguage('en'); i18n.changeLanguage('en') }}
                className={`px-3 py-1.5 rounded-lg text-sm ${i18n.language === 'en' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                {t('common.en')}
              </button>
            </div>
          </div>
          <div className="p-4">
            <p className="text-sm text-gray-500 mb-2">{t('warehouse.switch')}</p>
            <select
              value={currentId ?? ''}
              onChange={(e) => e.target.value && setCurrent(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              {list.map((w) => (
                <option key={w.id} value={w.id}>
                  {i18n.language === 'en' ? w.name_en : w.name_zh}
                </option>
              ))}
            </select>
          </div>
          <div className="p-4">
            <button
              type="button"
              onClick={() => logout()}
              className="text-red-600 text-sm font-medium"
            >
              {t('common.logout')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
