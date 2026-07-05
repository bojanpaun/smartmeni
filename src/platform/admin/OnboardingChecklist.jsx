import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../context/PlatformContext'
import { useLibraryTranslations } from '../../lib/useLibraryTranslations'
import { MODULES } from '../../layouts/AdminLayout'
import styles from './OnboardingChecklist.module.css'

// Detektori statusa koraka — računaju `done` iz get_admin_overview brojki / restaurant
// objekta. Korak bez detect_key je RUČNI (korisnik ga sam označi). Novi detektor =
// dodaj ovdje + dozvoli vrijednost u dashboard_checklist_steps CHECK constraint-u.
const DETECTORS = {
  logo:         (data, restaurant) => !!restaurant?.logo_url,
  menu:         (data) => (data?.menu_items_count || 0) > 0,
  tables:       (data) => (data?.tables_count || 0) > 0,
  staff:        (data) => (data?.staff_count || 0) > 0,
  inventory:    (data) => (data?.inventory_items_count || 0) > 0,
  suppliers:    (data) => (data?.suppliers_count || 0) > 0,
  rooms:        (data) => (data?.total_rooms || 0) > 0,
  room_types:   (data) => (data?.room_types_count || 0) > 0,
  categories:   (data) => (data?.categories_count || 0) > 0,
  spa_services: (data) => (data?.spa_services_count || 0) > 0,
  roles:             (data) => (data?.roles_count || 0) > 0,
  recipes:           (data) => (data?.recipes_count || 0) > 0,
  therapists:        (data) => (data?.therapists_count || 0) > 0,
  rate_plans:        (data) => (data?.rate_plans_count || 0) > 0,
  rental_assets:     (data) => (data?.rental_assets_count || 0) > 0,
  schedule:          (data) => (data?.schedules_count || 0) > 0,
  table_assignments: (data) => (data?.table_assignments_count || 0) > 0,
}

// Modul → vertikala (mirror ControlPanel *_KEYS). Moduli van mape (hr/inventory/
// guests/analytics) su dijeljeni — gejtuju se samo permisijom/addonom iz MODULES.
const MODULE_VERTICAL = { menu: 'restaurant', tables: 'restaurant', hotel: 'hotel', spa: 'hotel', rental: 'rental' }

// Korak vezan za modul se vidi SAMO ako je taj modul dostupan tenantu — ista logika
// kao prikaz modul-kartice na ControlPanel-u (vertikala + addon + permisija).
function moduleVisible(moduleKey, hasVertical, hasAddon, canSee) {
  if (!moduleKey) return true
  const mod = MODULES.find(m => m.key === moduleKey)
  if (MODULE_VERTICAL[moduleKey] && !hasVertical(MODULE_VERTICAL[moduleKey])) return false
  if (mod?.addonId && !hasAddon(mod.addonId)) return false
  if (mod?.perm && !canSee(mod.perm)) return false
  return true
}

// Koraci dostupni tenantu (vertikala + permisija + addon + vidljivost modula). Izvučeno
// da i ControlPanel može jeftino provjeriti „ima li uopšte koraka" za link za vraćanje
// kartice — bez dupliranja gating logike.
export function selectAvailableSteps(steps, { hasVertical, hasAddon, canSee }) {
  return steps.filter(s =>
    (!s.vertical || hasVertical(s.vertical)) && canSee(s.perm) && (!s.addon || hasAddon(s.addon)) &&
    moduleVisible(s.module, hasVertical, hasAddon, canSee),
  )
}

// „Početni koraci" kartica na admin početnoj. Prima `data` (get_admin_overview) + stanje
// koraka (useChecklistSteps, pozvan u ControlPanel-u, bez dodatnog RPC-a). Vlasnik/superadmin
// posao (kao „Vodič"). Kad su svi dostupni koraci gotovi → čestitka; korisnik je može i ručno
// sakriti (×, perzistuje se), a vrati je linkom uz KPI red. Deep-linka na prave stranice.
export default function OnboardingChecklist({ data, steps, manualDone, markDone, dismissed, setDismissed, loaded }) {
  const { t } = useTranslation('admin')
  const navigate = useNavigate()
  const { restaurant, hasVertical, hasPermission, hasAddon, isOwner, isSuperAdmin } = usePlatform()
  const lt = useLibraryTranslations()

  // Kompaktno po defaultu: prikazuje se samo traka (naslov + progres); koraci se
  // raširuju na klik. Stanje u localStorage (pouzdano po pregledniku, nezavisno od
  // DB dismiss-a) → poslije refresha ostaje sklopljeno kako je korisnik ostavio.
  const OPEN_KEY = 'sm_checklist_open'
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(OPEN_KEY) === '1' } catch { return false }
  })
  const toggleOpen = () => setOpen(v => {
    const nv = !v
    try { localStorage.setItem(OPEN_KEY, nv ? '1' : '0') } catch { /* private mode */ }
    return nv
  })

  const canManage = isOwner() || isSuperAdmin()
  const canSee = (perm) => !perm || canManage || hasPermission(perm)

  // Gating po vertikali/permisiji/addonu (isto kao dashboard kartice/task traka).
  const available = useMemo(() => selectAvailableSteps(steps, { hasVertical, hasAddon, canSee }),
    [steps, hasVertical, hasAddon, hasPermission, isOwner, isSuperAdmin])

  const isDone = (s) => s.detect_key && DETECTORS[s.detect_key]
    ? DETECTORS[s.detect_key](data, restaurant)
    : manualDone.includes(s.id)

  const doneCount = available.filter(isDone).length
  const labelOf = (s) => lt('dashboard_checklist', s.id, 'label', s.label)

  // Grupiši korake u sekcije po modulu (NULL → opšta sekcija „Osnovno"). available je
  // već sortiran po sort_order, pa redoslijed sekcija prati prvi korak svake grupe.
  const moduleMeta = (key) => MODULES.find(m => m.key === key)
  const groups = useMemo(() => {
    const m = new Map()
    for (const s of available) {
      const k = s.module || '__general'
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(s)
    }
    return [...m.entries()]
  }, [available])

  const renderStep = (s) => {
    const done = isDone(s)
    const manual = !s.detect_key
    return (
      <div key={s.id} className={`${styles.step} ${done ? styles.stepDone : ''}`}>
        <span className={styles.stepIcon}>{done ? '✅' : s.icon}</span>
        <button className={styles.stepLabel} onClick={() => !done && navigate(s.path)} disabled={done}>
          {labelOf(s)}
        </button>
        {done ? (
          <span className={styles.stepCheck}>{t('checklistDone')}</span>
        ) : manual ? (
          <button className={styles.markBtn} onClick={() => markDone(s.id)}>{t('checklistMarkDone')}</button>
        ) : (
          <button className={styles.goBtn} onClick={() => navigate(s.path)} aria-label={labelOf(s)}>→</button>
        )}
      </div>
    )
  }

  if (!canManage || !loaded) return null
  if (available.length === 0) return null   // nema nijednog koraka za ovaj tenant
  if (dismissed) return null                 // korisnik sakrio → ControlPanel nudi vraćanje

  // Svi koraci gotovi → čestitka (umjesto tihog nestajanja). × je trajno sakrije.
  if (doneCount === available.length) return (
    <div className={styles.card}>
      <div className={styles.doneBanner}>
        <span className={styles.doneIcon}>🎉</span>
        <div className={styles.doneTextWrap}>
          <span className={styles.title}>{t('checklistAllDoneTitle')}</span>
          <span className={styles.doneSub}>{t('checklistAllDoneText')}</span>
        </div>
        <button className={styles.dismissBtn} onClick={() => setDismissed(true)} aria-label={t('checklistHide')}>✕</button>
      </div>
    </div>
  )

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <button className={styles.headToggle} onClick={toggleOpen} aria-expanded={open}>
          <span className={styles.chevron} aria-hidden="true">{open ? '▾' : '▸'}</span>
          <span className={styles.title}>🚀 {t('checklistTitle')}</span>
        </button>
        <span className={styles.progressText}>{t('checklistProgress', { done: doneCount, total: available.length })}</span>
        <button className={styles.dismissBtn} onClick={() => setDismissed(true)} aria-label={t('checklistHide')}>✕</button>
      </div>
      <div className={`${styles.progressBar} ${open ? '' : styles.progressBarCollapsed}`}>
        <div className={styles.progressFill} style={{ width: `${(doneCount / available.length) * 100}%` }} />
      </div>
      {open && (
        <div className={styles.steps}>
          {groups.map(([gkey, gsteps]) => {
            const meta = gkey === '__general' ? null : moduleMeta(gkey)
            const header = gkey === '__general'
              ? t('checklistGeneral')
              : meta ? `${meta.icon} ${t(meta.labelKey)}` : gkey
            return (
              <div key={gkey} className={styles.group}>
                {groups.length > 1 && <div className={styles.groupHead}>{header}</div>}
                {gsteps.map(renderStep)}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
