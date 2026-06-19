import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'
import styles from './ActiveLayoutBanner.module.css'

// §8.5 — upozorenje kad aktivan raspored stolova NIJE standardni (najstariji).
// `is_active` je globalan flag (nije vezan za datum), pa ako vlasnik aktivira event
// layout i zaboravi vratiti, live tok (narudžbe/QR) radi nad pogrešnim stolovima.
// Standardni = najstariji layout (prvi kreiran / backfill „Standardni raspored").
export default function ActiveLayoutBanner() {
  const { restaurant, hasVertical, hasPermission } = usePlatform()
  const navigate = useNavigate()
  const { t } = useTranslation('admin')
  const [layouts, setLayouts] = useState(null)
  const [busy, setBusy] = useState(false)

  const restaurantId = restaurant?.id
  const isRestaurant = !!hasVertical && hasVertical('restaurant')

  useEffect(() => {
    if (!restaurantId || !isRestaurant) return
    let cancelled = false
    supabase.from('table_layouts').select('id, name, is_active, created_at')
      .eq('restaurant_id', restaurantId).order('created_at')
      .then(({ data }) => { if (!cancelled) setLayouts(data || []) })
    return () => { cancelled = true }
  }, [restaurantId, isRestaurant])

  if (!isRestaurant || !layouts || layouts.length <= 1) return null
  const active = layouts.find(l => l.is_active)
  const standard = layouts[0] // najstariji = standardni
  if (!active || active.id === standard.id) return null

  const restoreStandard = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('set_active_table_layout', {
      p_restaurant_id: restaurantId, p_layout_id: standard.id,
    })
    setBusy(false)
    if (!error) setLayouts(prev => prev.map(l => ({ ...l, is_active: l.id === standard.id })))
  }

  return (
    <div className={styles.banner}>
      <span className={styles.icon}>⚠️</span>
      <span className={styles.text}>{t('albActiveNonStandard', { name: active.name })}</span>
      <div className={styles.actions}>
        <button className={styles.btnGhost} onClick={() => navigate('/admin/tables')}>{t('albManage')}</button>
        {hasPermission('manage_tables') && (
          <button className={styles.btn} onClick={restoreStandard} disabled={busy}>
            {t('albRestore', { name: standard.name })}
          </button>
        )}
      </div>
    </div>
  )
}
