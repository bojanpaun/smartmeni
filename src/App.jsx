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

function ProtectedRoute({ children }) {
  const { user, loading } = usePlatform()
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',fontFamily:'DM Sans,sans-serif',color:'#8a9e96'}}>Učitavanje...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/registracija" element={<Register />} />
      <Route path="/admin" element={<ProtectedRoute><AdminMenu /></ProtectedRoute>} />
      <Route path="/admin/menu" element={<ProtectedRoute><AdminMenu /></ProtectedRoute>} />
      <Route path="/admin/staff" element={<ProtectedRoute><StaffRoles /></ProtectedRoute>} />
      <Route path="/admin/waiter" element={<ProtectedRoute><WaiterDashboard /></ProtectedRoute>} />
      <Route path="/admin/orders" element={<ProtectedRoute><WaiterDashboard /></ProtectedRoute>} />
      <Route path="/admin/kitchen" element={<ProtectedRoute><KitchenDashboard /></ProtectedRoute>} />
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
