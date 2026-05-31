import { useState, useEffect } from 'react'
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
  { value: 'plumbing', label: 'Vodoinstalacije', icon: '🔧' },
  { value: 'electrical', label: 'Elektrika', icon: '⚡' },
  { value: 'ac', label: 'Klima', icon: '❄️' },
  { value: 'furniture', label: 'Namještaj', icon: '🪑' },
  { value: 'internet', label: 'Internet / TV', icon: '📡' },
  { value: 'other', label: 'Ostalo', icon: '🔩' },
]

export default function HousekeepingView({ staffId, restaurantId }) {
  const [tasks, setTasks]       = useState([])
  const [rooms, setRooms]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showMaint, setShowMaint]   = useState(false)
  const [maintForm, setMaintForm]   = useState({ room_id: '', category: 'other', description: '' })
  const [maintSaving, setMaintSaving] = useState(false)
  const [maintDone, setMaintDone]   = useState(false)

  useEffect(() => {
    if (!staffId || !restaurantId) return
    setLoading(true)
    Promise.all([
      supabase.from('housekeeping_tasks')
        .select('*, rooms(id, room_number, room_types(name))')
        .eq('restaurant_id', restaurantId)
        .eq('assigned_to', staffId)
        .eq('scheduled_for', TODAY)
        .order('priority', { ascending: false }),
      supabase.from('rooms').select('id, room_number')
        .eq('restaurant_id', restaurantId).order('room_number'),
    ]).then(([{ data: t }, { data: r }]) => {
      setTasks(t ?? [])
      setRooms(r ?? [])
      setLoading(false)
    })
  }, [staffId, restaurantId])

  const updateStatus = async (taskId, newStatus) => {
    const patch = { status: newStatus }
    if (newStatus === 'in_progress') patch.started_at = new Date().toISOString()
    if (newStatus === 'done')        patch.completed_at = new Date().toISOString()
    await supabase.from('housekeeping_tasks').update(patch).eq('id', taskId)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...patch } : t))
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

  const pending    = tasks.filter(t => t.status === 'pending').length
  const inProgress = tasks.filter(t => t.status === 'in_progress').length
  const done       = tasks.filter(t => t.status === 'done' || t.status === 'verified').length

  return (
    <div>
      <div className={s.statsRow}>
        <div className={s.statCard}><div className={s.statNum} style={{ color: '#e67e22' }}>{pending}</div><div className={s.statLabel}>Čeka</div></div>
        <div className={s.statCard}><div className={s.statNum} style={{ color: '#2563eb' }}>{inProgress}</div><div className={s.statLabel}>U toku</div></div>
        <div className={s.statCard}><div className={s.statNum} style={{ color: '#0d7a52' }}>{done}</div><div className={s.statLabel}>Završeno</div></div>
      </div>

      {tasks.length === 0 ? (
        <div className={s.empty}>
          <div className={s.emptyIcon}>✅</div>
          <div className={s.emptyText}>Nemate zadataka za danas.</div>
        </div>
      ) : (
        tasks.map(task => {
          const typeInfo = TASK_TYPES[task.type] || TASK_TYPES.stayover_clean
          const isDone = task.status === 'done' || task.status === 'verified'
          return (
            <div key={task.id} className={`${s.taskCard} ${isDone ? s.done : ''}`}>
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
                  {task.status === 'pending' && <button className={s.btnStart} onClick={() => updateStatus(task.id, 'in_progress')}>▶ Počni</button>}
                  {task.status === 'in_progress' && <button className={s.btnDone} onClick={() => updateStatus(task.id, 'done')}>✓ Završi</button>}
                  {isDone && <span className={s.doneLabel}>✅ Završeno</span>}
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
