import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../context/PlatformContext'
import { useLibraryTranslations } from '../../lib/useLibraryTranslations'
import { MODULES } from '../../layouts/AdminLayout'
import { useChecklistSteps } from './useChecklistSteps'
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

// „Početni koraci" kartica na admin početnoj. Prima `data` (get_admin_overview) iz
// ControlPanel-a — bez dodatnog RPC-a. Vlasnik/superadmin posao (kao „Vodič"); sakriva
// se kad su svi dostupni koraci završeni. Deep-linka na prave stranice (ne otvara wizard).
export default function OnboardingChecklist({ data }) {
  const { t } = useTranslation('admin')
  const navigate = useNavigate()
  const { user, restaurant, hasVertical, hasPermission, hasAddon, isOwner, isSuperAdmin } = usePlatform()
  const lt = useLibraryTranslations()
  const { steps, manualDone, markDone, loaded } = useChecklistSteps(user?.id)

  const canManage = isOwner() || isSuperAdmin()
  const canSee = (perm) => !perm || canManage || hasPermission(perm)

  // Gating po vertikali/permisiji/addonu (isto kao dashboard kartice/task traka).
  const available = useMemo(() => steps.filter(s =>
    (!s.vertical || hasVertical(s.vertical)) && canSee(s.perm) && (!s.addon || hasAddon(s.addon)) &&
    moduleVisible(s.module, hasVertical, hasAddon, canSee),
  ), [steps, hasVertical, hasAddon, hasPermission, isOwner, isSuperAdmin])

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
  if (available.length === 0 || doneCount === available.length) return null  // sve gotovo → sakrij

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.title}>🚀 {t('checklistTitle')}</span>
        <span className={styles.progressText}>{t('checklistProgress', { done: doneCount, total: available.length })}</span>
      </div>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${(doneCount / available.length) * 100}%` }} />
      </div>
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
    </div>
  )
}
