import { Outlet, Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Wrench,
  ArrowLeftRight,
  Hammer,
  ClipboardList,
  BarChart2,
  ScanLine,
  LogOut,
  Warehouse,
  Languages,
  Globe,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useWarehouseStore } from '@/stores/warehouseStore'

const navItems = [
  { path: '/dashboard', key: 'nav.dashboard', icon: LayoutDashboard },
  { path: '/tools',     key: 'nav.tools',     icon: Wrench },
  { path: '/borrow',    key: 'nav.borrow',    icon: ArrowLeftRight },
  { path: '/repair',    key: 'nav.repair',    icon: Hammer },
  { path: '/inventory', key: 'nav.inventory', icon: ClipboardList },
  { path: '/reports',   key: 'nav.reports',   icon: BarChart2 },
  { path: '/scan',      key: 'nav.scan',      icon: ScanLine },
] as const

export default function Layout() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { list, currentId, setCurrent } = useWarehouseStore()

  const toggleLanguage = () => {
   const newLang = i18n.language === 'zh' ? 'en' : 'zh'
   i18n.changeLanguage(newLang)
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        {/* Brand */}
        <div className="p-4 border-b border-gray-200 flex items-center gap-2">
          <Warehouse size={20} className="text-primary-600 shrink-0" />
          <h1 className="font-semibold text-primary-600 text-sm leading-tight">仓库工具管理</h1>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ path, key, icon: Icon }) => {
           const active = location.pathname === path
           return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon
                  size={16}
                  className={active ? 'text-primary-600' : 'text-gray-400'}
                />
                {t(key)}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 space-y-2">
          <select
            value={currentId ?? ''}
            onChange={(e) => e.target.value && setCurrent(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white"
          >
            <option value="">{t('warehouse.switch')}</option>
            {list.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name_zh}
              </option>
            ))}
          </select>
          
          {/* Language Switcher */}
          <button
           type="button"
            onClick={toggleLanguage}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Globe size={14} className="text-gray-600" />
              <span>{i18n.language === 'zh' ? '中文' : 'English'}</span>
            </div>
            <Languages size={14} className="text-gray-400" />
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 font-medium truncate">{user?.username}</p>
              {user?.role && (
                <span className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  user.role === 'admin'
                    ? 'bg-purple-100 text-purple-700'
                    : user.role === 'warehouse_manager'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {user.role === 'admin' ? '管理员' : user.role === 'warehouse_manager' ? '仓管员' : '普通用户'}
                </span>
              )}
            </div>
            <button
             type="button"
              onClick={() => logout()}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
            >
              <LogOut size={12} />
              {t('common.logout')}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
