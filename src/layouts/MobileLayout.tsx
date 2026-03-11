import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'

const tabs = [
  { path: '/dashboard', key: 'nav.dashboard' },
  { path: '/scan', key: 'nav.scan' },
  { path: '/tools', key: 'nav.tools' },
  { path: '/mine', key: 'nav.mine' },
] as const

export default function MobileLayout() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-16">
      <main className="flex-1 overflow-auto p-4">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-pb flex">
        {tabs.map(({ path, key }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex-1 py-3 text-center text-sm ${isActive ? 'text-primary-600 font-medium' : 'text-gray-500'}`
            }
          >
            {t(key)}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
