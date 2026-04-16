import { Routes, Route, Navigate } from 'react-router-dom'
import { PlatformProvider, usePlatform } from './context/PlatformContext'
import { CartProvider } from './context/CartContext'

import Landing from './platform/Landing'
import Login from './platform/auth/Login'
import Register from './platform/auth/Register'

import GuestMenu from './modules/menu/pages/GuestMenu'
import AdminMenu from './modules/menu/pages/AdminMenu'
import WaiterDashboard from './modules/menu/pages/WaiterDashboard'
import KitchenDashboard from './modules/menu/pages/KitchenDashboard'
import StaffRoles from './platform/superadmin/StaffRoles'

import AdminLayout from './layouts/AdminLayout'
import ControlPanel from './platform/admin/ControlPanel'
import ModuleHelp from './platform/admin/ModuleHelp'
import TemplateSettings from './modules/menu/pages/TemplateSettings'
import LogoUpload from './modules/menu/pages/LogoUpload'

function ProtectedRoute({ children }) {
  const { user, loading } = usePlatform()
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', fontFamily:'DM Sans,sans-serif', color:'#8a9e96' }}>
      Učitavanje...
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

// Wrapper koji wrapa sve admin stranice u AdminLayout
function AdminRoute({ children }) {
  return (
    <ProtectedRoute>
      <AdminLayout>
        {children}
      </AdminLayout>
    </ProtectedRoute>
  )
}

function AppRoutes() {
  return (
    <Routes>
      {/* Javne rute */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/registracija" element={<Register />} />

      {/* Kontrolna tabla — bez sidebara (AdminLayout ga sam sakrije za /admin) */}
      <Route path="/admin" element={<AdminRoute><ControlPanel /></AdminRoute>} />

      {/* Digitalni meni modul */}
      <Route path="/admin/menu" element={<AdminRoute><AdminMenu /></AdminRoute>} />
      <Route path="/admin/menu/help" element={<AdminRoute><ModuleHelp moduleKey="menu" /></AdminRoute>} />
      <Route path="/admin/settings" element={<AdminRoute><TemplateSettings /></AdminRoute>} />
      <Route path="/admin/settings/templates" element={<AdminRoute><TemplateSettings /></AdminRoute>} />
      <Route path="/admin/settings/logo" element={<AdminRoute><LogoUpload /></AdminRoute>} />
      <Route path="/admin/settings/general" element={<AdminRoute><TemplateSettings /></AdminRoute>} />
      <Route path="/admin/orders" element={<AdminRoute><WaiterDashboard /></AdminRoute>} />
      <Route path="/admin/waiter" element={<AdminRoute><WaiterDashboard /></AdminRoute>} />
      <Route path="/admin/kitchen" element={<AdminRoute><KitchenDashboard /></AdminRoute>} />

      {/* Osoblje modul */}
      <Route path="/admin/staff" element={<AdminRoute><StaffRoles /></AdminRoute>} />
      <Route path="/admin/staff/help" element={<AdminRoute><ModuleHelp moduleKey="staff" /></AdminRoute>} />

      {/* Pomoćne rute za ostale module (uputstva) */}
      <Route path="/admin/tables/help" element={<AdminRoute><ModuleHelp moduleKey="tables" /></AdminRoute>} />
      <Route path="/admin/inventory/help" element={<AdminRoute><ModuleHelp moduleKey="inventory" /></AdminRoute>} />
      <Route path="/admin/analytics/help" element={<AdminRoute><ModuleHelp moduleKey="analytics" /></AdminRoute>} />
      <Route path="/admin/settings/help" element={<AdminRoute><ModuleHelp moduleKey="settings" /></AdminRoute>} />

      {/* Guest meni */}
      <Route path="/:slug" element={<CartProvider><GuestMenu /></CartProvider>} />
    </Routes>
  )
}

export default function App() {
  return (
    <PlatformProvider>
      <AppRoutes />
    </PlatformProvider>
  )
}
