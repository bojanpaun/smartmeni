import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import s from '../StaffPortal.module.css'

const MAINT_CATS = [
  { value: 'plumbing',   labelKey: 'maintCatPlumbing', icon: '🔧' },
  { value: 'electrical', labelKey: 'maintCatElectrical', icon: '⚡' },
  { value: 'ac',         labelKey: 'maintCatAc',            icon: '❄️' },
  { value: 'furniture',  labelKey: 'maintCatFurniture',     icon: '🪑' },
  { value: 'internet',   labelKey: 'maintCatInternet',    icon: '📡' },
  { value: 'other',      labelKey: 'maintCatOther',           icon: '🔩' },
]

const PRIORITY_COLOR = {
  urgent: '#c0392b',
  high:   '#e67e22',
  normal: '#0d7a52',
  low:    '#9ca3af',
}

const FILTERS = [
  { key: 'open',        labelKey: 'filterOpen',     color: '#c0392b' },
  { key: 'in_progress', labelKey: 'filterInProgress',        color: '#e67e22' },
  { key: 'done',        labelKey: 'filterDone',      color: '#0d7a52' },
  { key: 'verified',    labelKey: 'filterVerified',  color: '#7c3aed' },
]

export default function MaintenanceView({ staffId, restaurantId, onRefresh }) {
  const { t } = useTranslation('staffportal')
  const [items, setItems]         = useState([])
  const [rooms, setRooms]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [filterStatus, setFilterStatus] = useState(null)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({ room_id: '', category: 'other', description: '' })
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  const load = useCallback(async () => {
    if (!restaurantId) return
    const [{ data: mData }, { data: rData }] = await Promise.all([
      supabase.from('maintenance_requests')
        .select('*, rooms(room_number, floor), staff!maintenance_requests_reported_by_fkey(first_name, last_name)')
        .eq('restaurant_id', restaurantId)
        .neq('status', 'resolved')
        .order('priority', { ascending: false })
        .order('created_at'),
      supabase.from('rooms')
        .select('id, room_number')
        .eq('restaurant_id', restaurantId)
        .order('room_number'),
    ])
    setItems(mData ?? [])
    setRooms(rData ?? [])
    setLoading(false)
  }, [restaurantId])

  useEffect(() => {
    if (!staffId || !restaurantId) return
    setLoading(true)
    load()
  }, [staffId, restaurantId, load])

  const loadRef = useRef(load)
  const onRefreshRef = useRef(onRefresh)
  useEffect(() => { loadRef.current = load }, [load])
  useEffect(() => { onRefreshRef.current = onRefresh }, [onRefresh])

  useEffect(() => {
    if (!restaurantId) return
    const ch = supabase.channel(`maint-portal-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_requests',
        filter: `restaurant_id=eq.${restaurantId}` }, () => { loadRef.current(); onRefreshRef.current?.() })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [restaurantId])

  const updateStatus = async (id, status) => {
    const patch = { status }
    if (status === 'verified') patch.resolved_at = new Date().toISOString()
    await supabase.from('maintenance_requests').update(patch).eq('id', id)
    if (status === 'verified') {
      const item = items.find(m => m.id === id)
      if (item?.rooms?.room_number) {
        const { data: roomRow } = await supabase
          .from('rooms').select('id').eq('restaurant_id', restaurantId)
          .eq('room_number', item.rooms.room_number).maybeSingle()
        if (roomRow) await supabase.from('rooms').update({ status: 'available' }).eq('id', roomRow.id)
      }
    }
    setItems(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m))
    onRefresh?.()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.description.trim()) return
    setSaving(true)
    await supabase.from('maintenance_requests').insert({
      restaurant_id: restaurantId,
      reported_by: staffId,
      room_id: form.room_id || null,
      category: form.category,
      description: form.description.trim(),
      priority: 'normal',
    })
    setSaving(false)
    setSaved(true)
    setForm({ room_id: '', category: 'other', description: '' })
    setTimeout(() => { setSaved(false); setShowForm(false) }, 2000)
    load()
    onRefresh?.()
  }

  if (loading) return <div className={s.loadingInline}>{t('loadingRequests')}</div>

  const counts = {
    open:        items.filter(m => m.status === 'open').length,
    in_progress: items.filter(m => m.status === 'in_progress').length,
    done:        items.filter(m => m.status === 'done').length,
    verified:    items.filter(m => m.status === 'verified').length,
  }

  const visibleItems = filterStatus
    ? items.filter(m => m.status === filterStatus)
    : items

  return (
    <div>
      <div className={s.statsRow}>
        {FILTERS.map(f => {
          const active = filterStatus === f.key
          return (
            <button
              key={f.key}
              className={s.statCard}
              onClick={() => setFilterStatus(active ? null : f.key)}
              style={{
                cursor: 'pointer',
                border: 'none',
                fontFamily: 'inherit',
                boxShadow: active
                  ? `0 0 0 2px ${f.color}`
                  : '0 1px 4px rgba(0,0,0,0.05)',
                background: active ? `${f.color}14` : '#fff',
              }}
            >
              <div className={s.statNum} style={{ color: f.color }}>{counts[f.key]}</div>
              <div className={s.statLabel}>{t(f.labelKey)}</div>
            </button>
          )
        })}
      </div>

      {!showForm ? (
        <button className={s.maintToggle} onClick={() => setShowForm(true)}>
          🔧 {t('reportNewIssue')}
        </button>
      ) : (
        <form onSubmit={handleSubmit} className={s.maintForm}>
          <div className={s.maintFormTitle}>{t('newIssueTitle')}</div>
          <select className={s.maintSelect} value={form.room_id}
            onChange={e => setForm(f => ({ ...f, room_id: e.target.value }))}>
            <option value="">{t('roomOptional')}</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{t('room')} {r.room_number}</option>)}
          </select>
          <select className={s.maintSelect} value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {MAINT_CATS.map(c => <option key={c.value} value={c.value}>{c.icon} {t(c.labelKey)}</option>)}
          </select>
          <textarea className={s.maintTextarea} placeholder={t('describeProblem')}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={3} required />
          {saved
            ? <div className={s.maintSuccess}>✅ {t('faultReported')}</div>
            : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className={s.btnSecondary}
                  onClick={() => { setShowForm(false); setForm({ room_id: '', category: 'other', description: '' }) }}>
                  {t('cancel')}
                </button>
                <button type="submit" className={s.btnPrimary} disabled={saving} style={{ flex: 2 }}>
                  {saving ? t('sending') : t('sendReport')}
                </button>
              </div>
            )
          }
        </form>
      )}

      {visibleItems.length === 0 ? (
        <div className={s.empty} style={{ marginTop: 16 }}>
          <div className={s.emptyIcon}>✅</div>
          <div className={s.emptyText}>
            {filterStatus
              ? t('noRequestsInStatus', { status: t(FILTERS.find(f => f.key === filterStatus)?.labelKey) })
              : t('noActiveRequests')
            }
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          {visibleItems.map(m => {
            const cat = MAINT_CATS.find(c => c.value === m.category) || MAINT_CATS[5]
            const isVerified = m.status === 'verified'
            const isDimmed = m.status === 'done' || isVerified
            const reporter = m.staff
              ? `${m.staff.first_name || ''} ${m.staff.last_name || ''}`.trim()
              : null
            return (
              <div key={m.id} className={`${s.taskCard} ${isDimmed ? s.done : ''}`}>
                <div className={s.priorityStrip}
                  style={{ background: PRIORITY_COLOR[m.priority] || PRIORITY_COLOR.normal }} />
                <div className={s.taskBody}>
                  <div className={s.taskRoom}>
                    <span style={{ fontSize: 22 }}>{cat.icon}</span>
                    <div>
                      {m.rooms?.room_number
                        ? <div className={s.taskRoomNum}>{t('room')} {m.rooms.room_number}</div>
                        : <div className={s.taskRoomNum}>{t('commonArea')}</div>
                      }
                      <div className={s.taskRoomType}>{t(cat.labelKey)}</div>
                    </div>
                    {m.priority === 'urgent' && <span className={s.urgentBadge}>{t('urgent')}</span>}
                  </div>
                  <div className={s.taskNotes}>{m.description}</div>
                  {reporter && (
                    <div className={s.taskTypeLabel}>{t('reportedBy', { name: reporter })}</div>
                  )}
                  <div className={s.taskActionRow}>
                    {m.status === 'open'        && <button className={s.btnStart}  onClick={() => updateStatus(m.id, 'in_progress')}>▶ {t('toWork')}</button>}
                    {m.status === 'in_progress' && <button className={s.btnDone}   onClick={() => updateStatus(m.id, 'done')}>✓ {t('finish')}</button>}
                    {m.status === 'done'        && <button className={s.btnVerify} onClick={() => updateStatus(m.id, 'verified')}>⭐ {t('verify')}</button>}
                    {isVerified                 && <span   className={s.verifiedLabel}>⭐ {t('verifiedLabel')}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
