import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import s from '../StaffPortal.module.css'

const TODAY = new Date().toISOString().slice(0, 10)
const TASK_TYPES = {
  checkout_clean: { label: 'Checkout čišćenje', icon: '🚪' },
  stayover_clean: { label: 'Svakodnevno',        icon: '🧹' },
  turndown:       { label: 'Turndown servis',     icon: '🌙' },
  inspection:     { label: 'Inspekcija',          icon: '🔍' },
  deep_clean:     { label: 'Dubinsko čišćenje',   icon: '✨' },
}
const PRIORITY_COLOR = { urgent: '#c0392b', high: '#e67e22', normal: '#0d7a52', low: '#9ca3af' }
const MAINT_CATS = [
  { value: 'plumbing',   label: 'Vodoinstalacije', icon: '🔧' },
  { value: 'electrical', label: 'Elektrika',        icon: '⚡' },
  { value: 'ac',         label: 'Klima',            icon: '❄️' },
  { value: 'furniture',  label: 'Namještaj',        icon: '🪑' },
  { value: 'internet',   label: 'Internet / TV',    icon: '📡' },
  { value: 'other',      label: 'Ostalo',           icon: '🔩' },
]

const FILTERS = [
  { key: 'pending',     label: 'Čeka',         color: '#e67e22' },
  { key: 'in_progress', label: 'U toku',        color: '#2563eb' },
  { key: 'done',        label: 'Završeno',      color: '#0d7a52' },
  { key: 'verified',    label: 'Verifikovano',  color: '#7c3aed' },
]

export default function HousekeepingView({ staffId, restaurantId, onRefresh }) {
  const [tasks, setTasks]         = useState([])
  const [rooms, setRooms]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [filterStatus, setFilterStatus] = useState(null)
  const [showMaint, setShowMaint]   = useState(false)
  const [maintForm, setMaintForm]   = useState({ room_id: '', category: 'other', description: '' })
  const [maintSaving, setMaintSaving] = useState(false)
  const [maintDone, setMaintDone]   = useState(false)

  const load = useCallback(async () => {
    if (!restaurantId) return
    const [{ data: t }, { data: r }] = await Promise.all([
      supabase.from('housekeeping_tasks')
        .select('*, rooms(id, room_number, room_types(name))')
        .eq('restaurant_id', restaurantId)
        .eq('scheduled_for', TODAY)
        .order('priority', { ascending: false }),
      supabase.from('rooms').select('id, room_number')
        .eq('restaurant_id', restaurantId).order('room_number'),
    ])
    setTasks(t ?? [])
    setRooms(r ?? [])
    setLoading(false)
  }, [restaurantId])

  useEffect(() => {
    if (!staffId || !restaurantId) return
    setLoading(true)
    load()
  }, [staffId, restaurantId, load])

  useEffect(() => {
    if (!restaurantId) return
    const ch = supabase.channel(`hk-portal-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'housekeeping_tasks',
        filter: `restaurant_id=eq.${restaurantId}` }, () => { load(); onRefresh?.() })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [restaurantId, load, onRefresh])

  const updateStatus = async (taskId, newStatus) => {
    const patch = { status: newStatus }
    if (newStatus === 'in_progress') patch.started_at = new Date().toISOString()
    if (newStatus === 'done')        patch.completed_at = new Date().toISOString()
    if (newStatus === 'verified')    patch.verified_at = new Date().toISOString()
    await supabase.from('housekeeping_tasks').update(patch).eq('id', taskId)
    if (newStatus === 'verified') {
      const task = tasks.find(t => t.id === taskId)
      if (task?.rooms?.id) {
        await supabase.from('rooms').update({ status: 'available' }).eq('id', task.rooms.id)
      }
    }
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...patch } : t))
    onRefresh?.()
  }

  const handleMaintSubmit = async (e) => {
    e.preventDefault()
    if (!maintForm.description.trim()) return
    setMaintSaving(true)
    await supabase.from('maintenance_requests').insert({
      restaurant_id: restaurantId,
      reported_by: staffId,
      room_id: maintForm.room_id || null,
      category: maintForm.category,
      description: maintForm.description.trim(),
      priority: 'normal',
    })
    setMaintSaving(false)
    setMaintDone(true)
    setMaintForm({ room_id: '', category: 'other', description: '' })
    setTimeout(() => { setMaintDone(false); setShowMaint(false) }, 2500)
  }

  if (loading) return <div className={s.loadingInline}>Učitavanje zadataka...</div>

  const counts = {
    pending:     tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    done:        tasks.filter(t => t.status === 'done').length,
    verified:    tasks.filter(t => t.status === 'verified').length,
  }

  const visibleTasks = filterStatus
    ? tasks.filter(t => t.status === filterStatus)
    : tasks

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
              <div className={s.statLabel}>{f.label}</div>
            </button>
          )
        })}
      </div>

      {visibleTasks.length === 0 ? (
        <div className={s.empty}>
          <div className={s.emptyIcon}>✅</div>
          <div className={s.emptyText}>
            {filterStatus
              ? `Nema zadataka u statusu "${FILTERS.find(f => f.key === filterStatus)?.label}".`
              : 'Nema zadataka za danas.'
            }
          </div>
        </div>
      ) : (
        visibleTasks.map(task => {
          const typeInfo = TASK_TYPES[task.type] || TASK_TYPES.stayover_clean
          const isVerified = task.status === 'verified'
          const isDimmed = task.status === 'done' || isVerified
          return (
            <div key={task.id} className={`${s.taskCard} ${isDimmed ? s.done : ''}`}>
              <div className={s.priorityStrip} style={{ background: PRIORITY_COLOR[task.priority] || PRIORITY_COLOR.normal }} />
              <div className={s.taskBody}>
                <div className={s.taskRoom}>
                  <span style={{ fontSize: 22 }}>{typeInfo.icon}</span>
                  <div>
                    <div className={s.taskRoomNum}>Soba {task.rooms?.room_number ?? '—'}</div>
                    {task.rooms?.room_types?.name && <div className={s.taskRoomType}>{task.rooms.room_types.name}</div>}
                  </div>
                  {task.priority === 'urgent' && <span className={s.urgentBadge}>HITNO</span>}
                </div>
                <div className={s.taskTypeLabel}>{typeInfo.label}</div>
                {task.notes && <div className={s.taskNotes}>{task.notes}</div>}
                <div className={s.taskActionRow}>
                  {task.status === 'pending'     && <button className={s.btnStart}  onClick={() => updateStatus(task.id, 'in_progress')}>▶ Počni</button>}
                  {task.status === 'in_progress' && <button className={s.btnDone}   onClick={() => updateStatus(task.id, 'done')}>✓ Završi</button>}
                  {task.status === 'done'        && <button className={s.btnVerify} onClick={() => updateStatus(task.id, 'verified')}>⭐ Verifikuj</button>}
                  {isVerified                    && <span   className={s.verifiedLabel}>⭐ Verifikovano</span>}
                </div>
              </div>
            </div>
          )
        })
      )}

      <div style={{ marginTop: 12 }}>
        {!showMaint ? (
          <button className={s.maintToggle} onClick={() => setShowMaint(true)}>🔧 Prijavi kvar ili problem</button>
        ) : (
          <form onSubmit={handleMaintSubmit} className={s.maintForm}>
            <div className={s.maintFormTitle}>Prijava problema</div>
            <select className={s.maintSelect} value={maintForm.room_id} onChange={e => setMaintForm(f => ({ ...f, room_id: e.target.value }))}>
              <option value="">— Soba (opcionalno) —</option>
              {rooms.map(r => <option key={r.id} value={r.id}>Soba {r.room_number}</option>)}
            </select>
            <select className={s.maintSelect} value={maintForm.category} onChange={e => setMaintForm(f => ({ ...f, category: e.target.value }))}>
              {MAINT_CATS.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
            </select>
            <textarea className={s.maintTextarea} placeholder="Opišite problem..." value={maintForm.description}
              onChange={e => setMaintForm(f => ({ ...f, description: e.target.value }))} rows={3} required />
            {maintDone
              ? <div className={s.maintSuccess}>✅ Problem prijavljen!</div>
              : <button type="submit" className={s.btnPrimary} disabled={maintSaving}>{maintSaving ? 'Slanje...' : 'Pošalji prijavu'}</button>
            }
          </form>
        )}
      </div>
    </div>
  )
}
