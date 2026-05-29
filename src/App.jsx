import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { PlatformProvider, usePlatform } from './context/PlatformContext'
import { CartProvider } from './context/CartContext'
import LoadingSpinner from './components/shared/LoadingSpinner'
import UpgradePrompt from './components/shared/UpgradePrompt'
import AdminLayout from './layouts/AdminLayout'

const Landing              = lazy(() => import('./platform/Landing'))
const Login                = lazy(() => import('./platform/auth/Login'))
const Register             = lazy(() => import('./platform/auth/Register'))

const GuestMenu            = lazy(() => import('./layouts/GuestMenu'))
const AdminMenu            = lazy(() => import('./modules/menu/pages/AdminMenu'))
const WaiterDashboard      = lazy(() => import('./modules/menu/pages/WaiterDashboard'))
const KitchenDashboard     = lazy(() => import('./modules/menu/pages/KitchenDashboard'))
const StaffRoles           = lazy(() => import('./platform/superadmin/StaffRoles'))
const SuperAdminPanel      = lazy(() => import('./platform/superadmin/SuperAdminPanel'))
const TableMapEditor       = lazy(() => import('./modules/tables/pages/TableMapEditor'))
const WaiterMapView        = lazy(() => import('./modules/tables/pages/WaiterMapView'))
const ReservationsPage     = lazy(() => import('./modules/tables/pages/ReservationsPage'))
const TablesAnalytics      = lazy(() => import('./modules/tables/pages/TablesAnalytics'))
const StaffPortalPage      = lazy(() => import('./modules/hr/pages/StaffPortalPage'))
const StaffPortalInfo      = lazy(() => import('./modules/hr/pages/StaffPortalInfo'))
const OnlineReservationForm = lazy(() => import('./modules/tables/pages/OnlineReservationForm'))
const InventoryPage        = lazy(() => import('./modules/inventory/pages/InventoryPage'))
const MovementsLog         = lazy(() => import('./modules/inventory/pages/MovementsLog'))
const IngredientsEditor    = lazy(() => import('./modules/inventory/pages/IngredientsEditor'))
const InventoryAnalytics   = lazy(() => import('./modules/inventory/pages/InventoryAnalytics'))
const AnalyticsPage        = lazy(() => import('./modules/analytics/pages/AnalyticsPage'))
const GuestsPage           = lazy(() => import('./modules/guests/pages/GuestsPage'))
const GuestRegisterPage    = lazy(() => import('./modules/guests/pages/GuestRegisterPage'))
const GuestPortalPage      = lazy(() => import('./modules/guests/pages/GuestPortalPage'))
const GuestLoginPage       = lazy(() => import('./modules/guests/pages/GuestLoginPage'))
const GuestProfilePage     = lazy(() => import('./modules/guests/pages/GuestProfilePage'))
const OrderTrackerPage     = lazy(() => import('./modules/guests/pages/OrderTrackerPage'))
const SchedulePage         = lazy(() => import('./modules/hr/pages/SchedulePage'))
const StaffPage            = lazy(() => import('./modules/hr/pages/StaffPage'))
const StaffProfilePage     = lazy(() => import('./modules/hr/pages/StaffProfilePage'))
const AttendancePage       = lazy(() => import('./modules/hr/pages/AttendancePage'))
const PayrollPage          = lazy(() => import('./modules/hr/pages/PayrollPage'))
const HRReportsPage        = lazy(() => import('./modules/hr/pages/HRReportsPage'))

const HotelDashboard       = lazy(() => import('./modules/hotel/pages/HotelDashboard'))
const RoomsPage            = lazy(() => import('./modules/hotel/pages/RoomsPage'))
const RoomTypesPage        = lazy(() => import('./modules/hotel/pages/RoomTypesPage'))
const HotelReservationsPage = lazy(() => import('./modules/hotel/pages/ReservationsPage'))
const ReservationForm      = lazy(() => import('./modules/hotel/pages/ReservationForm'))
const FrontDeskPage        = lazy(() => import('./modules/hotel/pages/FrontDeskPage'))
const CalendarPage         = lazy(() => import('./modules/hotel/pages/CalendarPage'))
const FolioPage            = lazy(() => import('./modules/hotel/pages/FolioPage'))
const FolioPrint           = lazy(() => import('./modules/hotel/pages/FolioPrint'))
const RatePlansPage        = lazy(() => import('./modules/hotel/pages/RatePlansPage'))
const BookingPage          = lazy(() => import('./pages/BookingPage'))

const ControlPanel         = lazy(() => import('./platform/admin/ControlPanel'))
const ModuleHelp           = lazy(() => import('./platform/admin/ModuleHelp'))
const TemplateSettings     = lazy(() => import('./modules/menu/pages/TemplateSettings'))
const LogoUpload           = lazy(() => import('./modules/menu/pages/LogoUpload'))
const GeneralSettings      = lazy(() => import('./modules/menu/pages/GeneralSettings'))
const AdminMenuQR          = lazy(() => import('./modules/menu/pages/AdminMenuQR'))
const AdminMenuSettings    = lazy(() => import('./modules/menu/pages/AdminMenuSettings'))
const AdminMenuAnalytics   = lazy(() => import('./modules/menu/pages/AdminMenuAnalytics'))
const BillingPage          = lazy(() => import('./modules/menu/pages/BillingPage'))
const BillingSuccess       = lazy(() => import('./platform/admin/BillingSuccess'))
const MyAccount            = lazy(() => import('./platform/admin/MyAccount'))

function ProtectedRoute({ children }) {
  const { user, loading } = usePlatform()
  if (loading) return <LoadingSpinner fullPage />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AdminRoute({ children }) {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Suspense fallback={<LoadingSpinner fullPage />}>
          {children}
        </Suspense>
      </AdminLayout>
    </ProtectedRoute>
  )
}

function AddonGuard({ addonId, name, description, price, category, dependsOn, children }) {
  const { hasAddon } = usePlatform()
  if (!hasAddon(addonId)) {
    return (
      <UpgradePrompt
        addonId={addonId}
        name={name}
        description={description}
        price={price}
        category={category}
        dependsOn={dependsOn}
        fullPage
      />
    )
  }
  return children
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner fullPage />}>
      <Routes>
        {/* Javne rute */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/registracija" element={<Register />} />

        {/* Kontrolna tabla */}
        <Route path="/admin" element={<AdminRoute><ControlPanel /></AdminRoute>} />

        {/* Digitalni meni modul */}
        <Route path="/admin/menu/analytics" element={<AdminRoute><AdminMenuAnalytics /></AdminRoute>} />
        <Route path="/admin/menu/qr" element={<AdminRoute><AdminMenuQR /></AdminRoute>} />
        <Route path="/admin/menu/settings" element={<AdminRoute><AdminMenuSettings /></AdminRoute>} />
        <Route path="/admin/menu/help" element={<AdminRoute><ModuleHelp moduleKey="menu" /></AdminRoute>} />
        <Route path="/admin/menu/items" element={<Navigate to="/admin/menu" replace />} />
        <Route path="/admin/menu" element={<AdminRoute><AdminMenu /></AdminRoute>} />
        <Route path="/admin/settings" element={<AdminRoute><TemplateSettings /></AdminRoute>} />
        <Route path="/admin/settings/templates" element={<AdminRoute><TemplateSettings /></AdminRoute>} />
        <Route path="/admin/settings/logo" element={<AdminRoute><LogoUpload /></AdminRoute>} />
        <Route path="/admin/settings/general" element={<AdminRoute><GeneralSettings /></AdminRoute>} />
        <Route path="/admin/billing" element={<AdminRoute><BillingPage /></AdminRoute>} />
        <Route path="/admin/billing/success" element={<AdminRoute><BillingSuccess /></AdminRoute>} />
        <Route path="/admin/orders" element={<AdminRoute><WaiterDashboard /></AdminRoute>} />
        <Route path="/admin/waiter" element={<AdminRoute><WaiterDashboard /></AdminRoute>} />
        <Route path="/admin/kitchen" element={<AdminRoute><KitchenDashboard /></AdminRoute>} />

        {/* Osoblje modul */}
        <Route path="/admin/staff" element={<AdminRoute><StaffRoles /></AdminRoute>} />
        <Route path="/admin/staff/roles" element={<AdminRoute><StaffRoles /></AdminRoute>} />
        <Route path="/admin/staff/roles/help" element={<AdminRoute><ModuleHelp moduleKey="staff" /></AdminRoute>} />
        <Route path="/admin/staff/help" element={<AdminRoute><ModuleHelp moduleKey="staff" /></AdminRoute>} />

        {/* Stolovi modul */}
        <Route path="/admin/tables/analytics" element={<AdminRoute><TablesAnalytics /></AdminRoute>} />
        <Route path="/admin/tables" element={<AdminRoute><TableMapEditor /></AdminRoute>} />
        <Route path="/admin/tables/view" element={<AdminRoute><WaiterMapView /></AdminRoute>} />
        <Route path="/admin/tables/help" element={<AdminRoute><ModuleHelp moduleKey="tables" /></AdminRoute>} />
        <Route path="/admin/reservations" element={<AdminRoute><ReservationsPage /></AdminRoute>} />

        {/* Moj nalog */}
        <Route path="/admin/account" element={<AdminRoute><MyAccount /></AdminRoute>} />

        {/* Super admin panel */}
        <Route path="/superadmin" element={<AdminRoute><SuperAdminPanel /></AdminRoute>} />

        {/* Inventar modul */}
        <Route path="/admin/inventory/analytics" element={<AdminRoute><AddonGuard addonId="inventory_pro" name="Inventar Pro" description="Napredna analitika potrošnje zaliha, trendovi i izvještaji po kategorijama." price={149} category="restaurant"><InventoryAnalytics /></AddonGuard></AdminRoute>} />
        <Route path="/admin/inventory" element={<AdminRoute><InventoryPage /></AdminRoute>} />
        <Route path="/admin/inventory/movements" element={<AdminRoute><MovementsLog /></AdminRoute>} />
        <Route path="/admin/inventory/recipes" element={<AdminRoute><AddonGuard addonId="inventory_pro" name="Inventar Pro" description="Upravljanje receptima, FIFO rotacija zaliha i automatska upozorenja za niske zalihe." price={149} category="restaurant"><IngredientsEditor /></AddonGuard></AdminRoute>} />
        <Route path="/admin/inventory/help" element={<AdminRoute><ModuleHelp moduleKey="inventory" /></AdminRoute>} />

        {/* HR modul */}
        <Route path="/admin/hr" element={<Navigate to="/admin/hr/attendance" replace />} />
        <Route path="/admin/hr/staff" element={<AdminRoute><StaffPage /></AdminRoute>} />
        <Route path="/admin/hr/staff/:staffId" element={<AdminRoute><StaffProfilePage /></AdminRoute>} />
        <Route path="/admin/hr/schedule" element={<AdminRoute><SchedulePage /></AdminRoute>} />
        <Route path="/admin/hr/attendance" element={<AdminRoute><AttendancePage /></AdminRoute>} />
        <Route path="/admin/hr/payroll" element={<AdminRoute><AddonGuard addonId="hr_pro" name="HR Pro" description="Payroll obračun, export platnih lista i evidencija godišnjih odmora." price={149} category="restaurant"><PayrollPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hr/reports" element={<AdminRoute><AddonGuard addonId="hr_pro" name="HR Pro" description="Detaljni HR izvještaji — troškovi osoblja, produktivnost i analitika prisustva." price={149} category="restaurant"><HRReportsPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hr/help" element={<AdminRoute><ModuleHelp moduleKey="hr" /></AdminRoute>} />
        <Route path="/admin/hr/staff-portal-info" element={<AdminRoute><StaffPortalInfo /></AdminRoute>} />

        {/* Hotel Core modul */}
        <Route path="/admin/hotel" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><HotelDashboard /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/rooms" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><RoomsPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/room-types" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><RoomTypesPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/reservations" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><HotelReservationsPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/reservations/new" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><ReservationForm /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/reservations/:id" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><ReservationForm /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/frontdesk" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><FrontDeskPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/calendar" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><CalendarPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/reservations/:id/folio" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><FolioPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/rate-plans" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><RatePlansPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/help" element={<AdminRoute><ModuleHelp moduleKey="hotel" /></AdminRoute>} />
        <Route path="/admin/hotel/reservations/:id/folio/print" element={<ProtectedRoute><Suspense fallback={<LoadingSpinner fullPage />}><FolioPrint /></Suspense></ProtectedRoute>} />

        {/* Analitika modul */}
        <Route path="/admin/analytics" element={<AdminRoute><AddonGuard addonId="analytics_pro" name="Analitika Pro" description="Napredna analitika prihoda, export u PDF/Excel i prilagođeni datumski rasponi." price={99} category="restaurant"><AnalyticsPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/guests" element={<AdminRoute><GuestsPage /></AdminRoute>} />
        <Route path="/admin/guests/help" element={<AdminRoute><ModuleHelp moduleKey="guests" /></AdminRoute>} />
        <Route path="/admin/guests/:id" element={<AdminRoute><GuestProfilePage /></AdminRoute>} />
        <Route path="/admin/analytics/help" element={<AdminRoute><ModuleHelp moduleKey="analytics" /></AdminRoute>} />
        <Route path="/admin/settings/help" element={<AdminRoute><ModuleHelp moduleKey="settings" /></AdminRoute>} />

        {/* Javne rute restorana — redosljed je bitan! */}
        <Route path="/:slug/rezervacija" element={<Suspense fallback={<LoadingSpinner fullPage />}><OnlineReservationForm /></Suspense>} />
        <Route path="/:slug/registracija" element={<Suspense fallback={<LoadingSpinner fullPage />}><GuestRegisterPage /></Suspense>} />
        <Route path="/:slug/profil" element={<Suspense fallback={<LoadingSpinner fullPage />}><GuestPortalPage /></Suspense>} />
        <Route path="/:slug/prijava" element={<Suspense fallback={<LoadingSpinner fullPage />}><GuestLoginPage /></Suspense>} />
        <Route path="/:slug/narudzba/:orderId" element={<Suspense fallback={<LoadingSpinner fullPage />}><OrderTrackerPage /></Suspense>} />
        <Route path="/:slug/osoblje" element={<Suspense fallback={<LoadingSpinner fullPage />}><StaffPortalPage /></Suspense>} />
        <Route path="/:slug/book" element={<Suspense fallback={<LoadingSpinner fullPage />}><BookingPage /></Suspense>} />
        <Route path="/:slug" element={<CartProvider><Suspense fallback={<LoadingSpinner fullPage />}><GuestMenu /></Suspense></CartProvider>} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <PlatformProvider>
      <AppRoutes />
    </PlatformProvider>
  )
}
