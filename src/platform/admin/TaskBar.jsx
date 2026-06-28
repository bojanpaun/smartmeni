import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../context/PlatformContext'
import { useLibraryTranslations } from '../../lib/useLibraryTranslations'
import { useDashboardTasks } from './useDashboardTasks'
import styles from './TaskBar.module.css'

// Task traka na admin početnoj: korisnik kuca CILJ („dodaj jelo") umjesto da traži
// funkciju u modulu. Lista dolazi iz dashboard_tasks (superadmin kurira); gating po
// stavci je isti kao za dashboard kartice (vertical/perm/addon). Labele se prevode
// kroz library_translations (useLibraryTranslations), fallback na izvor (label).
export default function TaskBar() {
  const { t } = useTranslation('admin')
  const navigate = useNavigate()
  const { hasVertical, hasPermission, hasAddon, isOwner, isSuperAdmin } = usePlatform()
  const lt = useLibraryTranslations()
  const { tasks } = useDashboardTasks()
  const [query, setQuery] = useState('')

  // Gating identičan dashboard karticama (ControlPanel): vertikala + permisija + addon.
  const canSee = (perm) => !perm || isOwner() || isSuperAdmin() || hasPermission(perm)
  const available = useMemo(() => tasks.filter(task =>
    (!task.vertical || hasVertical(task.vertical)) &&
    canSee(task.perm) &&
    (!task.addon || hasAddon(task.addon)),
  ), [tasks, hasVertical, hasAddon, isOwner, isSuperAdmin, hasPermission])

  // Labela na jeziku panela (prevod ili izvor) — koristi se i za prikaz i za pretragu.
  const labelOf = (task) => lt('dashboard_task', task.id, 'label', task.label)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return available
    return available.filter(task => labelOf(task).toLowerCase().includes(q))
  }, [available, query, lt])

  // Sakrij cijelu traku ako nema nijednog dostupnog zadatka (npr. tenant bez ijedne
  // odgovarajuće vertikale/permisije, ili prazna lista).
  if (available.length === 0) return null

  return (
    <div className={styles.bar}>
      <div className={styles.inputWrap}>
        <span className={styles.searchIcon}>🔎</span>
        <input
          className={styles.input}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('taskbarPlaceholder')}
          aria-label={t('taskbarPlaceholder')}
        />
      </div>
      {filtered.length > 0 ? (
        <div className={styles.chips}>
          {filtered.map(task => (
            <button
              key={task.id}
              className={styles.chip}
              onClick={() => navigate(task.path)}
            >
              <span className={styles.chipIcon}>{task.icon}</span>
              <span className={styles.chipLabel}>{labelOf(task)}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.noResults}>{t('taskbarNoResults')}</div>
      )}
    </div>
  )
}
