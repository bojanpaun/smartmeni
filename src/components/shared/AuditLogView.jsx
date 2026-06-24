import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'
import styles from './AuditLogView.module.css'

const PAGE_SIZE = 50

// Mašinski kodovi → i18n labele (nepoznati kodovi fallback-uju na sam kod).
const ACTION_KEYS = {
  'tenant.password_changed': 'audActPasswordChanged',
  'tenant.suspended':        'audActSuspended',
  'tenant.reactivated':      'audActReactivated',
  'tenant.plan_changed':     'audActPlanChanged',
  'tenant.approved':         'audActApproved',
  'tenant.rejected':         'audActRejected',
  'invoice.storno':          'audActInvoiceStorno',
  'invoice.split':           'audActInvoiceSplit',
  'reservation.deleted':     'audActReservationDeleted',
  'staff.created':           'audActStaffCreated',
  'staff.activated':         'audActStaffActivated',
  'staff.deactivated':       'audActStaffDeactivated',
  'staff.deleted':           'audActStaffDeleted',
  'menu_item.created':       'audActMenuItemCreated',
  'menu_item.updated':       'audActMenuItemUpdated',
  'menu_item.deleted':       'audActMenuItemDeleted',
  'menu_item.visibility':    'audActMenuItemVisibility',
  'category.created':        'audActCategoryCreated',
  'category.updated':        'audActCategoryUpdated',
  'category.deleted':        'audActCategoryDeleted',
  'reservation.checkin':         'audActResCheckin',
  'reservation.checkout':        'audActResCheckout',
  'folio.close':                 'audActFolioClose',
  'folio_item.add':              'audActFolioItemAdd',
  'folio_item.remove':           'audActFolioItemRemove',
  'spa_appointment.create':      'audActSpaCreate',
  'spa_appointment.cancel':      'audActSpaCancel',
  'spa_appointment.complete':    'audActSpaComplete',
  'restaurant.settings_update':  'audActSettingsUpdate',
  'restaurant.tax_rates_update': 'audActTaxUpdate',
  'restaurant.tax_rates_reset':  'audActTaxReset',
  'payment_config.create':       'audActPaymentCreate',
  'payment_config.update':       'audActPaymentUpdate',
  'payment_config.delete':       'audActPaymentDelete',
  'payment_config.activate':     'audActPaymentActivate',
  'payment_config.deactivate':   'audActPaymentDeactivate',
  'payment_credentials.save':    'audActPaymentCreds',
}
const ROLE_KEYS = {
  superadmin: 'audRoleSuperadmin',
  owner:      'audRoleOwner',
  staff:      'audRoleStaff',
  system:     'audRoleSystem',
}

// scope: 'superadmin' (sve, uz filtere po tenantu) | 'tenant' (samo svoj nalog)
export default function AuditLogView({ scope = 'tenant' }) {
  const superadmin = scope === 'superadmin'
  const { isSuperAdmin, isOwner, restaurant } = usePlatform()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('admin')
  const dl = i18n.language === 'en' ? 'en-US' : 'sr-Latn'
  const restaurantId = restaurant?.id

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [tenants, setTenants] = useState([])      // superadmin: lista za filter + mapu imena
  const [fTenant, setFTenant] = useState('all')
  const [fAction, setFAction] = useState('all')
  const [fSearch, setFSearch] = useState('')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')

  // Lista tenanta za superadmin filter + mapiranje id → ime.
  useEffect(() => {
    if (!superadmin) return
    supabase.from('restaurants').select('id, name').order('name')
      .then(({ data }) => setTenants(data || []))
  }, [superadmin])
  const tenantName = useCallback(
    (id) => tenants.find(x => x.id === id)?.name || (id ? '—' : t('audPlatform')),
    [tenants, t],
  )

  const load = useCallback(async (pageNum) => {
    setLoading(true)
    let q = supabase.from('audit_log')
      .select('id, restaurant_id, actor_email, actor_role, action, entity_type, entity_id, summary, created_at')
      .order('created_at', { ascending: false })
      .range(pageNum * PAGE_SIZE, pageNum * PAGE_SIZE + PAGE_SIZE - 1)

    if (superadmin) {
      if (fTenant !== 'all') q = q.eq('restaurant_id', fTenant)
    } else if (restaurantId) {
      q = q.eq('restaurant_id', restaurantId) // defense in depth (RLS već ograničava)
    }
    if (fAction !== 'all') q = q.eq('action', fAction)
    if (fSearch.trim()) q = q.ilike('actor_email', `%${fSearch.trim()}%`)
    if (fFrom) q = q.gte('created_at', fFrom)
    if (fTo)   q = q.lte('created_at', fTo + 'T23:59:59')

    const { data, error } = await q
    if (!error) {
      setRows(data || [])
      setHasMore((data || []).length === PAGE_SIZE)
    }
    setLoading(false)
  }, [superadmin, fTenant, fAction, fSearch, fFrom, fTo, restaurantId])

  // Promjena filtera → nazad na prvu stranicu.
  useEffect(() => { setPage(0); load(0) }, [load])

  // Realtime: novi zapis u trenutnom opsegu → osvježi prvu stranicu (ako smo na njoj).
  // Ref pattern (CLAUDE.md §7): load/page NISU u depsu subscription useEffect-a.
  const loadRef = useRef(load); loadRef.current = load
  const pageRef = useRef(page); pageRef.current = page
  useEffect(() => {
    const scopeKey = superadmin ? 'super' : (restaurantId || 'none')
    const ch = supabase
      .channel(`audit-log-${scope}-${scopeKey}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log' }, () => {
        if (pageRef.current === 0) loadRef.current(0)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [scope, superadmin, restaurantId])

  const goPage = (next) => { setPage(next); load(next) }

  if (superadmin ? !isSuperAdmin() : !(isOwner() || isSuperAdmin())) {
    return (
      <div className={styles.accessDenied}>
        <div>🔒</div>
        <div>{t('saNoAccess')}</div>
      </div>
    )
  }

  const actionLabel = (a) => (ACTION_KEYS[a] ? t(ACTION_KEYS[a]) : a)
  const roleLabel = (r) => (ROLE_KEYS[r] ? t(ROLE_KEYS[r]) : (r || '—'))

  const todayStr = new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD (lokalno)
  const todayActive = fFrom === todayStr && fTo === todayStr
  const toggleToday = () => {
    if (todayActive) { setFFrom(''); setFTo('') }
    else { setFFrom(todayStr); setFTo(todayStr) }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <div className={styles.headerTitle}>{t('audTitle')}</div>
          <div className={styles.headerSub}>{superadmin ? t('audSubSuper') : t('audSubTenant')}</div>
        </div>
        <button className={styles.btnGhost}
          onClick={() => navigate(superadmin ? '/superadmin' : '/admin/settings/general')}>
          ← {t(superadmin ? 'saBackSuper' : 'back')}
        </button>
      </div>

      {/* Filteri */}
      <div className={styles.filters}>
        {superadmin && (
          <select className={styles.filterInput} value={fTenant} onChange={e => setFTenant(e.target.value)}>
            <option value="all">{t('audFilterAllTenants')}</option>
            {tenants.map(tn => <option key={tn.id} value={tn.id}>{tn.name}</option>)}
          </select>
        )}
        <select className={styles.filterInput} value={fAction} onChange={e => setFAction(e.target.value)}>
          <option value="all">{t('audFilterAllActions')}</option>
          {Object.keys(ACTION_KEYS).map(a => <option key={a} value={a}>{t(ACTION_KEYS[a])}</option>)}
        </select>
        <input className={styles.filterInput} type="search" placeholder={t('audSearchActor')}
          value={fSearch} onChange={e => setFSearch(e.target.value)} />
        <button
          type="button"
          className={`${styles.todayBtn} ${todayActive ? styles.todayBtnActive : ''}`}
          onClick={toggleToday}
        >
          {t('audToday')}
        </button>
        <input className={styles.filterInput} type="date" value={fFrom} onChange={e => setFFrom(e.target.value)} title={t('audFrom')} />
        <input className={styles.filterInput} type="date" value={fTo} onChange={e => setFTo(e.target.value)} title={t('audTo')} />
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('audColTime')}</th>
              <th>{t('audColActor')}</th>
              <th>{t('audColRole')}</th>
              <th>{t('audColAction')}</th>
              {superadmin && <th>{t('audColTenant')}</th>}
              <th>{t('audColDetails')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={superadmin ? 6 : 5} className={styles.muted}>{t('loading')}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={superadmin ? 6 : 5} className={styles.muted}>{t('audEmpty')}</td></tr>
            ) : rows.map(r => (
              <tr key={r.id}>
                <td className={styles.nowrap} data-label={t('audColTime')}>{new Date(r.created_at).toLocaleString(dl)}</td>
                <td data-label={t('audColActor')}>{r.actor_email || '—'}</td>
                <td data-label={t('audColRole')}><span className={styles.roleBadge}>{roleLabel(r.actor_role)}</span></td>
                <td data-label={t('audColAction')}><span className={styles.actionBadge}>{actionLabel(r.action)}</span></td>
                {superadmin && <td data-label={t('audColTenant')}>{tenantName(r.restaurant_id)}</td>}
                <td className={styles.details} data-label={t('audColDetails')}>
                  {r.summary || ''}
                  {r.entity_type && <span className={styles.entityTag}>{r.entity_type}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.pager}>
        <button className={styles.btnGhost} disabled={page === 0 || loading} onClick={() => goPage(page - 1)}>
          ← {t('audPrev')}
        </button>
        <span className={styles.pageNum}>{t('audPage')} {page + 1}</span>
        <button className={styles.btnGhost} disabled={!hasMore || loading} onClick={() => goPage(page + 1)}>
          {t('audNext')} →
        </button>
      </div>
    </div>
  )
}
