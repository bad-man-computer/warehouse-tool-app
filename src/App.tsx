import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useWarehouseStore } from '@/stores/warehouseStore'
import Layout from '@/layouts/Layout'
import MobileLayout from '@/layouts/MobileLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import ToolList from '@/pages/ToolList'
import BorrowReturn from '@/pages/BorrowReturn'
import Repair from '@/pages/Repair'
import Inventory from '@/pages/Inventory'
import Reports from '@/pages/Reports'
import Scan from '@/pages/Scan'
import Mine from '@/pages/Mine'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 768
  const [mobile, setMobile] = useState(isMobile())
  useEffect(() => {
    const onResize = () => setMobile(isMobile())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const Wrapper = mobile ? MobileLayout : Layout
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Wrapper />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="tools" element={<ToolList />} />
        <Route path="borrow" element={<BorrowReturn />} />
        <Route path="repair" element={<Repair />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="reports" element={<Reports />} />
        <Route path="scan" element={<Scan />} />
        <Route path="mine" element={<Mine />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  const { i18n } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const loadProfile = useAuthStore((s) => s.loadProfile)
  const loadWarehouses = useWarehouseStore((s) => s.load)

  useEffect(() => {
    loadProfile()
    loadWarehouses()
  }, [loadProfile, loadWarehouses])

  useEffect(() => {
    if (user?.language && user.language !== i18n.language) i18n.changeLanguage(user.language)
  }, [user?.language, i18n])

  return <AppRoutes />
}
