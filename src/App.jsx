import { lazy, Suspense, Component, useEffect } from 'react'
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import i18n from './i18n'
import { isReady, DEFAULT_LANG } from './i18n/languages'
import { PlatformProvider, usePlatform } from './context/PlatformContext'
import { CartProvider } from './context/CartContext'
import LoadingSpinner from './components/shared/LoadingSpinner'
import UpgradePrompt from './components/shared/UpgradePrompt'
import PendingApproval from './platform/auth/PendingApproval'
import { AnnouncementsProvider } from './context/AnnouncementsContext'
import { SupportProvider } from './context/SupportContext'

const AdminLayout = lazy(() => import('./layouts/AdminLayout'))

const Landing              = lazy(() => import('./platform/Landing'))
const Login                = lazy(() => import('./platform/auth/Login'))
const Register             = lazy(() => import('./platform/auth/Register'))
const ResetPassword        = lazy(() => import('./platform/auth/ResetPassword'))

const GuestMenu            = lazy(() => import('./layouts/GuestMenu'))
const AdminMenu            = lazy(() => import('./modules/menu/pages/AdminMenu'))
const WaiterDashboard      = lazy(() => import('./modules/menu/pages/WaiterDashboard'))
const KitchenDashboard     = lazy(() => import('./modules/menu/pages/KitchenDashboard'))
const BarDashboard         = lazy(() => import('./modules/menu/pages/BarDashboard'))
const StaffRoles           = lazy(() => import('./platform/superadmin/StaffRoles'))
const SuperAdminPanel      = lazy(() => import('./platform/superadmin/SuperAdminPanel'))
const LibrariesAdmin       = lazy(() => import('./platform/superadmin/LibrariesAdmin'))
const NutritionAdmin       = lazy(() => import('./platform/superadmin/NutritionAdmin'))
const BillingControl       = lazy(() => import('./platform/superadmin/BillingControl'))
const SuperadminCommunication = lazy(() => import('./platform/superadmin/SuperadminCommunication'))
const ThemePalettesAdmin   = lazy(() => import('./platform/superadmin/ThemePalettesAdmin'))
const FaqAdmin              = lazy(() => import('./platform/superadmin/FaqAdmin'))
const AnnouncementsInbox    = lazy(() => import('./platform/admin/AnnouncementsInbox'))
const NotificationsPage     = lazy(() => import('./platform/admin/NotificationsPage'))
const SupportPage           = lazy(() => import('./platform/admin/SupportPage'))
const SupportFaqPage        = lazy(() => import('./platform/admin/SupportFaq'))
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
const HotelGuestsPage      = lazy(() => import('./modules/hotel/pages/GuestsPage'))
const BookingSettings      = lazy(() => import('./modules/hotel/pages/BookingSettings'))
const HousekeepingPage     = lazy(() => import('./modules/hotel/pages/HousekeepingPage'))
const MinibarPage          = lazy(() => import('./modules/hotel/pages/MinibarPage'))
const HousekeepingPortalPage = lazy(() => import('./modules/hotel/pages/HousekeepingPortalPage'))
const RevenueManagementPage = lazy(() => import('./modules/hotel/pages/RevenueManagementPage'))
const NightAuditPage       = lazy(() => import('./modules/hotel/pages/NightAuditPage'))
const BreakfastPage        = lazy(() => import('./modules/hotel/pages/BreakfastPage'))
const BookingPage          = lazy(() => import('./pages/BookingPage'))
const StaffPortal          = lazy(() => import('./pages/StaffPortal/StaffPortal'))
const GuestAppPage         = lazy(() => import('./modules/hotel/pages/GuestAppPage'))
const HotelLandingPage     = lazy(() => import('./modules/hotel/pages/HotelLandingPage'))
const HotelLandingEditor   = lazy(() => import('./modules/hotel/pages/HotelLandingEditor'))
const PaymentSettingsPage  = lazy(() => import('./modules/hotel/pages/PaymentSettingsPage'))
const RoomFormPage         = lazy(() => import('./modules/hotel/pages/RoomFormPage'))
const RestaurantLandingPage = lazy(() => import('./modules/menu/pages/RestaurantLandingPage'))

const SpaDashboard         = lazy(() => import('./modules/spa/pages/SpaDashboard'))
const SpaServicesPage      = lazy(() => import('./modules/spa/pages/ServicesPage'))
const SpaTherapistsPage    = lazy(() => import('./modules/spa/pages/TherapistsPage'))
const SpaRoomsPage         = lazy(() => import('./modules/spa/pages/SpaRoomsPage'))
const SpaSettingsPage      = lazy(() => import('./modules/spa/pages/SpaSettingsPage'))
const SpaCalendarPage      = lazy(() => import('./modules/spa/pages/SpaCalendarPage'))
const SpaBookingPage       = lazy(() => import('./pages/SpaBookingPage'))
const SpaAnalyticsPage     = lazy(() => import('./modules/spa/pages/SpaAnalyticsPage'))
const SpaPackagesPage      = lazy(() => import('./modules/spa/pages/PackagesPage'))
const SpaAppointmentsPage  = lazy(() => import('./modules/spa/pages/AppointmentsPage'))
const SpaRetailPage        = lazy(() => import('./modules/spa/pages/RetailPage'))
const RestaurantLandingEditor = lazy(() => import('./modules/menu/pages/RestaurantLandingEditor'))

const ControlPanel         = lazy(() => import('./platform/admin/ControlPanel'))
const ModuleHelp           = lazy(() => import('./platform/admin/ModuleHelp'))
const TemplateSettings     = lazy(() => import('./modules/menu/pages/TemplateSettings'))
const BrandSettings        = lazy(() => import('./modules/menu/pages/BrandSettings'))
const GeneralSettings      = lazy(() => import('./modules/menu/pages/GeneralSettings'))
const ThemeSettings        = lazy(() => import('./modules/menu/pages/ThemeSettings'))
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

// Gejt: vlasnik čiji tenant nije odobren (pending/rejected) ne ulazi u admin panel —
// vidi PendingApproval ekran. Superadmin i staff prolaze (isOwner() je tada false).
function ApprovalGate({ children }) {
  const { restaurant, isOwner } = usePlatform()
  if (isOwner() && restaurant?.approval_status && restaurant.approval_status !== 'approved') {
    return <PendingApproval status={restaurant.approval_status} />
  }
  return children
}

// Gejt: prijavljen korisnik bez tenanta (realno samo: superadmin koji ne posjeduje
// restoran) NE smije visjeti na ~40 admin stranica koje rade `if (!restaurant)
// return <Loading/>`. ProtectedRoute je već potvrdio da je učitavanje gotovo i da
// korisnik postoji → ako restorana nema, to je konačno stanje, ne „još se učitava".
// Izuzeci koji rade bez tenanta: sve /superadmin/* rute i /admin/account.
const NO_TENANT_OK = ['/admin/account']
function TenantGate({ children }) {
  const { restaurant, isSuperAdmin } = usePlatform()
  const { pathname } = useLocation()
  const superRoute = pathname === '/superadmin' || pathname.startsWith('/superadmin/')
  if (!restaurant && !superRoute && !NO_TENANT_OK.includes(pathname)) {
    // Superadmin bez vlastitog restorana → na njegov home umjesto spinnera.
    if (isSuperAdmin()) return <Navigate to="/superadmin" replace />
    // Vlasnici/staff uvijek imaju tenant; ovo je krajnji fallback (greška stanja).
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', color: 'var(--c-text-muted)' }}>
        Nalog nema povezan restoran. Obratite se podršci.
      </div>
    )
  }
  return children
}

function AdminRoute({ children }) {
  return (
    <ProtectedRoute>
      <ApprovalGate>
        <TenantGate>
          <AnnouncementsProvider>
            <SupportProvider>
              <Suspense fallback={<LoadingSpinner fullPage />}>
                <AdminLayout>
                  <Suspense fallback={<LoadingSpinner fullPage />}>
                    {children}
                  </Suspense>
                </AdminLayout>
              </Suspense>
            </SupportProvider>
          </AnnouncementsProvider>
        </TenantGate>
      </ApprovalGate>
    </ProtectedRoute>
  )
}

function AddonGuard({ addonId, name, description, price, category, dependsOn, children }) {
  const { hasAddon, addonPrice, addonCatalog } = usePlatform()
  if (!hasAddon(addonId)) {
    const dbAddon = addonCatalog?.find(a => a.id === addonId)
    return (
      <UpgradePrompt
        addonId={addonId}
        name={name}
        description={dbAddon?.description || description}
        features={dbAddon?.features || []}
        price={addonPrice(addonId, price)}
        category={category}
        dependsOn={dependsOn}
        fullPage
      />
    )
  }
  return children
}

// 2b/Faza 4: rute vertikale koja nije aktivna za ovaj tenant → nazad na hub.
// (Restoran je besplatna baza; hotel plaćen. hasVertical fallback drži restoran
//  vidljivim za zatečene tenante/staff.)
function VerticalGuard({ vertical, children }) {
  const { hasVertical } = usePlatform()
  if (!hasVertical(vertical)) return <Navigate to="/admin" replace />
  return children
}

// Redirect sa starog URL-a na /:slug/staff koristeći apsolutan path
function StaffPortalRedirect() {
  const { slug } = useParams()
  return <Navigate to={`/${slug}/staff`} replace />
}

class ChunkErrorBoundary extends Component {
  componentDidCatch(error) {
    if (
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Importing a module script failed')
    ) {
      window.location.reload()
    }
  }
  render() { return this.props.children }
}

// Dark mode je admin-only. Pri SPA navigaciji van /admin (npr. istek sesije →
// redirect na /login) skidamo data-theme da javne stranice ostanu svijetle.
// (Full-load / prvi paint pokriva inline skripta u index.html.)
function ThemeRouteSync() {
  const { pathname } = useLocation()
  useEffect(() => {
    const isAdmin = pathname.startsWith('/admin') || pathname.startsWith('/superadmin')
    if (!isAdmin) document.documentElement.removeAttribute('data-theme')
  }, [pathname])
  return null
}

// Hibridni admin jezik (Faza 2): per-tenant default (restaurants.admin_language)
// + per-sesija override (sessionStorage 'sm_admin_lang', postavlja switcher u
// AdminLayout headeru). Na admin rutama primjenjuje override→admin_language→me;
// van admina vraća gostov jezik (sm_lang) da javne stranice ne naslijede admin
// izbor pri SPA navigaciji. Mirror obrazac ThemeRouteSync-a.
const ADMIN_OVERRIDE_KEY = 'sm_admin_lang'
function AdminLangSync() {
  const { pathname } = useLocation()
  const { restaurant } = usePlatform()
  const adminLang = restaurant?.admin_language
  useEffect(() => {
    const isAdmin = pathname.startsWith('/admin') || pathname.startsWith('/superadmin')
    let desired
    if (isAdmin) {
      let override = null
      try { override = sessionStorage.getItem(ADMIN_OVERRIDE_KEY) } catch { /* ignore */ }
      desired = (override && isReady(override)) ? override
        : (adminLang && isReady(adminLang)) ? adminLang
        : DEFAULT_LANG
    } else {
      // Vrati gostov jezik (preslikava detectLang: sm_lang → browser → default)
      // da javne stranice ne naslijede admin izbor; idempotentno na prvom paintu.
      let stored = null
      try { stored = localStorage.getItem('sm_lang') } catch { /* ignore */ }
      let browser = null
      try { browser = navigator.language?.slice(0, 2).toLowerCase() } catch { /* ignore */ }
      desired = (stored && isReady(stored)) ? stored
        : (browser && isReady(browser)) ? browser
        : DEFAULT_LANG
    }
    if (desired && i18n.language !== desired) i18n.changeLanguage(desired)
  }, [pathname, adminLang])
  return null
}

function AppRoutes() {
  return (
    <ChunkErrorBoundary>
    <ThemeRouteSync />
    <AdminLangSync />
    <Suspense fallback={<LoadingSpinner fullPage />}>
      <Routes>
        {/* Javne rute */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/registracija" element={<Register />} />
        <Route path="/reset-lozinke" element={<ResetPassword />} />

        {/* Kontrolna tabla */}
        <Route path="/admin" element={<AdminRoute><ControlPanel /></AdminRoute>} />
        <Route path="/admin/notifications" element={<AdminRoute><NotificationsPage /></AdminRoute>} />
        <Route path="/admin/notifications/:section" element={<AdminRoute><NotificationsPage /></AdminRoute>} />
        <Route path="/admin/announcements" element={<AdminRoute><AnnouncementsInbox /></AdminRoute>} />
        <Route path="/admin/support" element={<AdminRoute><SupportPage /></AdminRoute>} />
        <Route path="/admin/support/faq" element={<AdminRoute><SupportFaqPage /></AdminRoute>} />

        {/* Digitalni meni modul (restoran vertikala) */}
        <Route path="/admin/menu/analytics" element={<AdminRoute><VerticalGuard vertical="restaurant"><AdminMenuAnalytics /></VerticalGuard></AdminRoute>} />
        <Route path="/admin/menu/qr" element={<AdminRoute><VerticalGuard vertical="restaurant"><AdminMenuQR /></VerticalGuard></AdminRoute>} />
        <Route path="/admin/menu/settings" element={<AdminRoute><VerticalGuard vertical="restaurant"><AdminMenuSettings /></VerticalGuard></AdminRoute>} />
        <Route path="/admin/menu/landing" element={<AdminRoute><VerticalGuard vertical="restaurant"><RestaurantLandingEditor /></VerticalGuard></AdminRoute>} />
        <Route path="/admin/menu/help" element={<AdminRoute><VerticalGuard vertical="restaurant"><ModuleHelp moduleKey="menu" /></VerticalGuard></AdminRoute>} />
        <Route path="/admin/menu/items" element={<Navigate to="/admin/menu" replace />} />
        <Route path="/admin/menu" element={<AdminRoute><VerticalGuard vertical="restaurant"><AdminMenu /></VerticalGuard></AdminRoute>} />
        {/* Landing Postavke modula → Osnovni podaci (NE predlošci — oni su menu-modul,
            dostupni preko /admin/menu/settings → tab Predlošci). */}
        <Route path="/admin/settings" element={<Navigate to="/admin/settings/general" replace />} />
        <Route path="/admin/settings/templates" element={<AdminRoute><TemplateSettings /></AdminRoute>} />
        <Route path="/admin/settings/brand" element={<AdminRoute><BrandSettings /></AdminRoute>} />
        {/* Stari link na Logo → Brend (logo je sad dio Brend sekcije) */}
        <Route path="/admin/settings/logo" element={<Navigate to="/admin/settings/brand" replace />} />
        <Route path="/admin/settings/general" element={<AdminRoute><GeneralSettings /></AdminRoute>} />
        <Route path="/admin/settings/theme" element={<AdminRoute><ThemeSettings /></AdminRoute>} />
        <Route path="/admin/settings/landing" element={<AdminRoute><RestaurantLandingEditor /></AdminRoute>} />
        <Route path="/admin/billing" element={<AdminRoute><BillingPage /></AdminRoute>} />
        <Route path="/admin/billing/success" element={<AdminRoute><BillingSuccess /></AdminRoute>} />
        <Route path="/admin/orders" element={<AdminRoute><VerticalGuard vertical="restaurant"><WaiterDashboard /></VerticalGuard></AdminRoute>} />
        <Route path="/admin/waiter" element={<AdminRoute><VerticalGuard vertical="restaurant"><WaiterDashboard /></VerticalGuard></AdminRoute>} />
        <Route path="/admin/kitchen" element={<AdminRoute><VerticalGuard vertical="restaurant"><KitchenDashboard /></VerticalGuard></AdminRoute>} />
        <Route path="/admin/bar"     element={<AdminRoute><VerticalGuard vertical="restaurant"><BarDashboard /></VerticalGuard></AdminRoute>} />

        {/* Osoblje modul */}
        <Route path="/admin/staff" element={<AdminRoute><StaffRoles /></AdminRoute>} />
        <Route path="/admin/staff/roles" element={<AdminRoute><StaffRoles /></AdminRoute>} />
        <Route path="/admin/staff/roles/help" element={<AdminRoute><ModuleHelp moduleKey="staff" /></AdminRoute>} />
        <Route path="/admin/staff/help" element={<AdminRoute><ModuleHelp moduleKey="staff" /></AdminRoute>} />

        {/* Stolovi modul (restoran vertikala) */}
        <Route path="/admin/tables/analytics" element={<AdminRoute><VerticalGuard vertical="restaurant"><TablesAnalytics /></VerticalGuard></AdminRoute>} />
        <Route path="/admin/tables" element={<AdminRoute><VerticalGuard vertical="restaurant"><TableMapEditor /></VerticalGuard></AdminRoute>} />
        <Route path="/admin/tables/view" element={<AdminRoute><VerticalGuard vertical="restaurant"><WaiterMapView /></VerticalGuard></AdminRoute>} />
        <Route path="/admin/tables/help" element={<AdminRoute><VerticalGuard vertical="restaurant"><ModuleHelp moduleKey="tables" /></VerticalGuard></AdminRoute>} />
        <Route path="/admin/reservations" element={<AdminRoute><VerticalGuard vertical="restaurant"><ReservationsPage /></VerticalGuard></AdminRoute>} />

        {/* Moj nalog */}
        <Route path="/admin/account" element={<AdminRoute><MyAccount /></AdminRoute>} />

        {/* Super admin panel */}
        <Route path="/superadmin" element={<AdminRoute><SuperAdminPanel /></AdminRoute>} />
        <Route path="/superadmin/podrska" element={<AdminRoute><SuperadminCommunication section="podrska" /></AdminRoute>} />
        <Route path="/superadmin/obavestenja" element={<AdminRoute><SuperadminCommunication section="obavestenja" /></AdminRoute>} />
        <Route path="/superadmin/faq" element={<AdminRoute><FaqAdmin /></AdminRoute>} />
        <Route path="/superadmin/theme" element={<AdminRoute><ThemePalettesAdmin /></AdminRoute>} />
        {/* Biblioteke — objedinjene pod jedan tab sa pill navigacijom */}
        <Route path="/superadmin/libraries" element={<Navigate to="/superadmin/libraries/recepti" replace />} />
        <Route path="/superadmin/libraries/:tab" element={<AdminRoute><LibrariesAdmin /></AdminRoute>} />
        <Route path="/superadmin/nutrition" element={<AdminRoute><NutritionAdmin /></AdminRoute>} />
        <Route path="/superadmin/billing" element={<AdminRoute><BillingControl /></AdminRoute>} />
        {/* Stari linkovi biblioteka → nove pilule */}
        <Route path="/superadmin/recipes" element={<Navigate to="/superadmin/libraries/recepti" replace />} />
        <Route path="/superadmin/spa-treatments" element={<Navigate to="/superadmin/libraries/tretmani" replace />} />
        <Route path="/superadmin/minibar-library" element={<Navigate to="/superadmin/libraries/minibar" replace />} />

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
        <Route path="/admin/hotel/rooms/new" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><RoomFormPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/rooms/:id" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><RoomFormPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/room-types" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><RoomTypesPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/reservations" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><HotelReservationsPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/reservations/new" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><ReservationForm /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/reservations/:id" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><ReservationForm /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/frontdesk" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><FrontDeskPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/calendar" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><CalendarPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/reservations/:id/folio" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><FolioPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/rate-plans" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><RatePlansPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/booking-settings" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><BookingSettings /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/housekeeping" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><HousekeepingPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/minibar" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><MinibarPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/revenue" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><RevenueManagementPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/night-audit" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><NightAuditPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/breakfast" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><BreakfastPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/landing" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><HotelLandingEditor /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/guests" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><HotelGuestsPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/payment" element={<AdminRoute><AddonGuard addonId="hotel_core" name="Hotel Core" description="Upravljanje sobama, rezervacijama, front desk i folio sistemom." price={299} category="hotel"><PaymentSettingsPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/hotel/help" element={<AdminRoute><ModuleHelp moduleKey="hotel" /></AdminRoute>} />

        {/* Spa & Wellness modul — vlastita sekcija */}
        <Route path="/admin/spa" element={<AdminRoute><AddonGuard addonId="spa_wellness" name="Spa & Wellness" description="Upravljanje spa tretmanima, terapeutima, kalendarom i booking sistemom." price={199} category="hotel"><SpaDashboard /></AddonGuard></AdminRoute>} />
        <Route path="/admin/spa/services" element={<AdminRoute><AddonGuard addonId="spa_wellness" name="Spa & Wellness" description="Upravljanje spa tretmanima, terapeutima, kalendarom i booking sistemom." price={199} category="hotel"><SpaServicesPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/spa/therapists" element={<AdminRoute><AddonGuard addonId="spa_wellness" name="Spa & Wellness" description="Upravljanje spa tretmanima, terapeutima, kalendarom i booking sistemom." price={199} category="hotel"><SpaTherapistsPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/spa/rooms" element={<AdminRoute><AddonGuard addonId="spa_wellness" name="Spa & Wellness" description="Upravljanje spa tretmanima, terapeutima, kalendarom i booking sistemom." price={199} category="hotel"><SpaRoomsPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/spa/settings" element={<AdminRoute><AddonGuard addonId="spa_wellness" name="Spa & Wellness" description="Upravljanje spa tretmanima, terapeutima, kalendarom i booking sistemom." price={199} category="hotel"><SpaSettingsPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/spa/calendar" element={<AdminRoute><AddonGuard addonId="spa_wellness" name="Spa & Wellness" description="Upravljanje spa tretmanima, terapeutima, kalendarom i booking sistemom." price={199} category="hotel"><SpaCalendarPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/spa/analytics" element={<AdminRoute><AddonGuard addonId="spa_wellness" name="Spa & Wellness" description="Upravljanje spa tretmanima, terapeutima, kalendarom i booking sistemom." price={199} category="hotel"><SpaAnalyticsPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/spa/packages" element={<AdminRoute><AddonGuard addonId="spa_wellness" name="Spa & Wellness" description="Upravljanje spa tretmanima, terapeutima, kalendarom i booking sistemom." price={199} category="hotel"><SpaPackagesPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/spa/appointments" element={<AdminRoute><AddonGuard addonId="spa_wellness" name="Spa & Wellness" description="Upravljanje spa tretmanima, terapeutima, kalendarom i booking sistemom." price={199} category="hotel"><SpaAppointmentsPage /></AddonGuard></AdminRoute>} />
        <Route path="/admin/spa/retail" element={<AdminRoute><AddonGuard addonId="spa_wellness" name="Spa & Wellness" description="Upravljanje spa tretmanima, terapeutima, kalendarom i booking sistemom." price={199} category="hotel"><SpaRetailPage /></AddonGuard></AdminRoute>} />
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
        {/* Unified staff portal */}
        <Route path="/:slug/staff" element={<Suspense fallback={<LoadingSpinner fullPage />}><StaffPortal /></Suspense>} />
        {/* Redirecti sa starih portal URL-ova — apsolutan path via useParams */}
        <Route path="/:slug/osoblje" element={<StaffPortalRedirect />} />
        <Route path="/:slug/housekeeping" element={<StaffPortalRedirect />} />
        <Route path="/:slug/book" element={<Suspense fallback={<LoadingSpinner fullPage />}><BookingPage /></Suspense>} />
        <Route path="/:slug/spa"  element={<Suspense fallback={<LoadingSpinner fullPage />}><SpaBookingPage /></Suspense>} />
        <Route path="/:slug/guest" element={<Suspense fallback={<LoadingSpinner fullPage />}><GuestAppPage /></Suspense>} />
        <Route path="/:slug/hotel" element={<Suspense fallback={<LoadingSpinner fullPage />}><HotelLandingPage /></Suspense>} />
        <Route path="/:slug/home" element={<Suspense fallback={<LoadingSpinner fullPage />}><RestaurantLandingPage /></Suspense>} />
        <Route path="/:slug" element={<CartProvider><Suspense fallback={<LoadingSpinner fullPage />}><GuestMenu /></Suspense></CartProvider>} />
      </Routes>
    </Suspense>
    </ChunkErrorBoundary>
  )
}

export default function App() {
  return (
    <PlatformProvider>
      <AppRoutes />
    </PlatformProvider>
  )
}
