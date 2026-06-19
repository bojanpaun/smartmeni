import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './EventsPage.module.css'
import gsStyles from '../../menu/pages/GeneralSettings.module.css'

const today = () => new Date().toISOString().slice(0, 10)

// Status → CSS klasa (token boje); ne inline po statusu (CLAUDE.md §5).
const STATUS_CLASS = {
  draft:     'stDraft',
  confirmed: 'stConfirmed',
  completed: 'stCompleted',
  cancelled: 'stCancelled',
}

export default function EventsPage() {
  const { restaurant, hasPermission } = usePlatform()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('admin')
  const dl = i18n.language === 'en' ? 'en-US' : 'sr-Latn'

  const [events, setEvents] = useState([])
  const [layouts, setLayouts] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', date: today(), expected_guests: '', layout_id: '' })

  const restaurantId = restaurant?.id
  const canManage = hasPermission('manage_tables')

  useEffect(() => {
    if (!restaurantId) return
    let cancelled = false
    Promise.all([
      supabase.from('events').select('id, name, date, status, expected_guests, layout_id')
        .eq('restaurant_id', restaurantId).order('date', { ascending: false }),
      supabase.from('table_layouts').select('id, name, is_active')
        .eq('restaurant_id', restaurantId).order('created_at'),
    ]).then(([{ data: evs }, { data: lays }]) => {
      if (cancelled) return
      setEvents(evs || [])
      setLayouts(lays || [])
      const active = (lays || []).find(l => l.is_active)
      setForm(f => ({ ...f, layout_id: active?.id || lays?.[0]?.id || '' }))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [restaurantId])

  const duplicateActiveLayout = async () => {
    const active = layouts.find(l => l.is_active)
    if (!active) return
    setBusy(true)
    const { data: newId } = await supabase.rpc('duplicate_table_layout', {
      p_layout_id: active.id, p_new_name: `${form.name || active.name} (event)`,
    })
    if (newId) {
      const { data: lays } = await supabase.from('table_layouts').select('id, name, is_active')
        .eq('restaurant_id', restaurantId).order('created_at')
      setLayouts(lays || [])
      setForm(f => ({ ...f, layout_id: newId }))
    }
    setBusy(false)
  }

  const createEvent = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setBusy(true)
    const { data, error } = await supabase.from('events').insert({
      restaurant_id: restaurantId,
      name: form.name.trim(),
      date: form.date,
      layout_id: form.layout_id || null,
      expected_guests: form.expected_guests ? parseInt(form.expected_guests) : null,
      status: 'draft',
    }).select('id').single()
    setBusy(false)
    if (!error && data) navigate(`/admin/tables/events/${data.id}`)
  }

  const filtered = filter === 'all' ? events : events.filter(ev => ev.status === filter)

  if (!hasPermission('view_tables')) return <div className={styles.empty}>{t('evNoPermission')}</div>

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h1 className={gsStyles.title} style={{ margin: 0 }}>{t('evTitle')}</h1>
          <p className={styles.subtitle}>{t('evSubtitle')}</p>
        </div>
        {canManage && (
          <button className={styles.btnNew} onClick={() => setShowForm(s => !s)}>
            + {t('evNewEvent')}
          </button>
        )}
      </div>

      {showForm && canManage && (
        <form className={styles.form} onSubmit={createEvent}>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>{t('evName')}</span>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t('evNamePlaceholder')} autoFocus />
            </label>
            <label className={styles.field}>
              <span>{t('evDate')}</span>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </label>
            <label className={styles.field}>
              <span>{t('evExpectedGuests')}</span>
              <input type="number" min="0" value={form.expected_guests}
                onChange={e => setForm(f => ({ ...f, expected_guests: e.target.value }))} />
            </label>
            <label className={styles.field}>
              <span>{t('evLayout')}</span>
              <select value={form.layout_id} onChange={e => setForm(f => ({ ...f, layout_id: e.target.value }))}>
                {layouts.map(l => (
                  <option key={l.id} value={l.id}>{l.name}{l.is_active ? ` · ${t('tmeLayoutActive')}` : ''}</option>
                ))}
              </select>
            </label>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnGhost} onClick={duplicateActiveLayout} disabled={busy}>
              ⧉ {t('evDuplicateActive')}
            </button>
            <div className={styles.formActionsRight}>
              <button type="button" className={styles.btnGhost} onClick={() => setShowForm(false)}>{t('evCancel')}</button>
              <button type="submit" className={styles.btnNew} disabled={busy || !form.name.trim()}>{t('evCreate')}</button>
            </div>
          </div>
        </form>
      )}

      <div className={styles.filters}>
        {['all', 'draft', 'confirmed', 'completed', 'cancelled'].map(s => (
          <button key={s} className={`${styles.filterBtn} ${filter === s ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter(s)}>
            {s === 'all' ? t('evFilterAll') : t(`evStatus_${s}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.empty}>{t('evLoading')}</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>{t('evNoEvents')}</div>
      ) : (
        <div className={styles.list}>
          {filtered.map(ev => (
            <button key={ev.id} className={styles.card} onClick={() => navigate(`/admin/tables/events/${ev.id}`)}>
              <div className={styles.cardMain}>
                <span className={styles.cardName}>{ev.name}</span>
                <span className={styles.cardDate}>
                  {new Date(ev.date + 'T00:00:00').toLocaleDateString(dl, { day: 'numeric', month: 'short', year: 'numeric' })}
                  {ev.expected_guests ? ` · ${t('evGuestsCount', { count: ev.expected_guests })}` : ''}
                </span>
              </div>
              <span className={`${styles.badge} ${styles[STATUS_CLASS[ev.status]]}`}>{t(`evStatus_${ev.status}`)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
