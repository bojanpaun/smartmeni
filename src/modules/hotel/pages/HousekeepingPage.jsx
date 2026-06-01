import { useState } from 'react'
import { usePlatform } from '../../../context/PlatformContext'
import { useHousekeeping } from '../hooks/useHousekeeping'
import { useRooms } from '../hooks/useRooms'
import { supabase } from '../../../lib/supabase'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import styles from './Hotel.module.css'
import hk from './Housekeeping.module.css'

const TODAY = new Date().toISOString().slice(0, 10)

const TASK_TYPES = [
  { value: 'checkout_clean', label: 'Checkout čišćenje',  icon: '🚪' },
  { value: 'stayover_clean', label: 'Svakodnevno',         icon: '🧹' },
  { value: 'turndown',       label: 'Turndown',            icon: '🌙' },
  { value: 'inspection',     label: 'Inspekcija',          icon: '🔍' },
  { value: 'deep_clean',     label: 'Dubinsko čišćenje',   icon: '✨' },
]

const PRIORITY_MAP = {
  urgent: { label: 'Hitno',    color: '#c0392b', bg: '#fde0e0' },
  high:   { label: 'Visok',    color: '#e67e22', bg: '#fdf0e0' },
  normal: { label: 'Normalan', color: '#0d7a52', bg: '#e0f5ec' },
  low:    { label: 'Nizak',    color: '#8a9e96', bg: '#f0f5f2' },
}

const STATUS_MAP = {
  pending:     { label: 'Na čekanju',    icon: '⏳', color: '#e67e22' },
  in_progress: { label: 'U toku',        icon: '🔄', color: '#2563eb' },
  done:        { label: 'Završeno',      icon: '✅', color: '#0d7a52' },
  verified:    { label: 'Verifikovano',  icon: '⭐', color: '#7c3aed' },
}

const MAINT_CATS = [
  { value: 'plumbing',    label: 'Vodoinstalacije',  icon: '🔧' },
  { value: 'electrical',  label: 'Elektrika',         icon: '⚡' },
  { value: 'ac',          label: 'Klima',             icon: '❄️' },
  { value: 'furniture',   label: 'Namještaj',         icon: '🪑' },
  { value: 'internet',    label: 'Internet / TV',     icon: '📡' },
  { value: 'other',       label: 'Ostalo',            icon: '🔩' },
]

const BLANK_TASK = { room_id: '', type: 'stayover_clean', priority: 'normal', assigned_to: '', notes: '', scheduled_for: TODAY }
const BLANK_MAINT = { room_id: '', category: 'other', priority: 'normal', description: '' }

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.pending
  return <span className={hk.statusBadge} style={{ color: s.color }}>{s.icon} {s.label}</span>
}

function PriorityBadge({ priority }) {
  const p = PRIORITY_MAP[priority] || PRIORITY_MAP.normal
  return (
    <span className={hk.priorityBadge} style={{ color: p.color, background: p.bg }}>
      {p.label}
    </span>
  )
}

export default function HousekeepingPage() {
  const { restaurant } = usePlatform()
  const [date, setDate] = useState(TODAY)
  const [tab, setTab] = useState('tasks')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showMaintForm, setShowMaintForm] = useState(false)
  const [taskForm, setTaskForm] = useState(BLANK_TASK)
  const [maintForm, setMaintForm] = useState(BLANK_MAINT)
  const [saving, setSaving] = useState(false)

  const { tasks, maintenance, staff, loading, refetch, updateTaskStatus, assignTask } = useHousekeeping(restaurant?.id, date)
  const { rooms } = useRooms(restaurant?.id)

  if (!restaurant) return <LoadingSpinner fullPage />

  // Stats
  const pending    = tasks.filter(t => t.status === 'pending').length
  const inProgress = tasks.filter(t => t.status === 'in_progress').length
  const done       = tasks.filter(t => t.status === 'done').length
  const verified   = tasks.filter(t => t.status === 'verified').length
  const maintOpen  = maintenance.filter(m => m.status === 'open').length

  const filteredTasks = statusFilter === 'all'
    ? tasks
    : tasks.filter(t => t.status === statusFilter)

  const handleTaskStatusChange = async (task, newStatus) => {
    const err = await updateTaskStatus(task.id, newStatus)
    if (err) toast.error('Greška pri ažuriranju')
    else toast.success(`Zadatak — ${STATUS_MAP[newStatus]?.label}`)
  }

  const handleAssign = async (taskId, staffId) => {
    const err = await assignTask(taskId, staffId)
    if (err) toast.error('Greška pri dodjeli')
  }

  const handleSaveTask = async () => {
    if (!taskForm.room_id) return toast.error('Odaberite sobu')
    setSaving(true)
    const { error } = await supabase.from('housekeeping_tasks').insert({
      ...taskForm,
      restaurant_id: restaurant.id,
      assigned_to: taskForm.assigned_to || null,
    })
    setSaving(false)
    if (error) return toast.error('Greška pri kreiranju zadatka')
    toast.success('Zadatak kreiran')
    setShowTaskForm(false)
    setTaskForm(BLANK_TASK)
    refetch()
  }

  const handleSaveMaint = async () => {
    if (!maintForm.description.trim()) return toast.error('Unesite opis problema')
    setSaving(true)
    const { error } = await supabase.from('maintenance_requests').insert({
      ...maintForm,
      restaurant_id: restaurant.id,
      room_id: maintForm.room_id || null,
    })
    setSaving(false)
    if (error) return toast.error('Greška pri kreiranju zahtjeva')
    toast.success('Zahtjev kreiran')
    setShowMaintForm(false)
    setMaintForm(BLANK_MAINT)
    refetch()
  }

  const handleMaintStatus = async (id, status) => {
    const patch = { status, updated_at: new Date().toISOString() }
    if (status === 'resolved') patch.resolved_at = new Date().toISOString()
    await supabase.from('maintenance_requests').update(patch).eq('id', id)
    toast.success(status === 'resolved' ? 'Zahtjev riješen' : 'Status ažuriran')
    refetch()
  }

  const roomOptions = rooms.filter(r => r.status !== 'available' || tab === 'tasks')

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Domaćinstvo</h1>
          <p className={styles.subtitle}>Zadaci čišćenja i zahtjevi za održavanje</p>
        </div>
        <div className={styles.headerActions}>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className={hk.datePicker}
          />
          <button className={styles.btnSecondary} onClick={() => setDate(TODAY)}>Danas</button>
          {restaurant?.slug && (
            <a
              href={`/${restaurant.slug}/housekeeping`}
              target="_blank"
              rel="noreferrer"
              className={styles.btnSecondary}
              title="Mobilni portal za sobarice"
            >
              📱 Portal
            </a>
          )}
          <button className={styles.btnPrimary}
            onClick={() => { setShowTaskForm(true); setShowMaintForm(false) }}>
            + Novi zadatak
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className={hk.stats}>
        <div className={hk.stat}>
          <div className={hk.statVal} style={{ color: '#e67e22' }}>{pending}</div>
          <div className={hk.statLabel}>Na čekanju</div>
        </div>
        <div className={hk.stat}>
          <div className={hk.statVal} style={{ color: '#2563eb' }}>{inProgress}</div>
          <div className={hk.statLabel}>U toku</div>
        </div>
        <div className={hk.stat}>
          <div className={hk.statVal} style={{ color: '#0d7a52' }}>{done}</div>
          <div className={hk.statLabel}>Završeno</div>
        </div>
        <div className={hk.stat}>
          <div className={hk.statVal} style={{ color: '#7c3aed' }}>{verified}</div>
          <div className={hk.statLabel}>Verifikovano</div>
        </div>
        <div className={hk.stat}>
          <div className={hk.statVal} style={{ color: '#c0392b' }}>{maintOpen}</div>
          <div className={hk.statLabel}>Maintenance otvoreni</div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.filterBar} style={{ marginBottom: 16 }}>
        <button className={`${styles.filterBtn} ${tab === 'tasks' ? styles.filterBtnActive : ''}`}
          onClick={() => setTab('tasks')}>
          Zadaci čišćenja <span className={styles.filterCount}>{tasks.length}</span>
        </button>
        <button className={`${styles.filterBtn} ${tab === 'maintenance' ? styles.filterBtnActive : ''}`}
          onClick={() => setTab('maintenance')}>
          Maintenance <span className={styles.filterCount}>{maintenance.length}</span>
        </button>
      </div>

      {loading && <LoadingSpinner />}

      {/* ── TASKS TAB ── */}
      {!loading && tab === 'tasks' && (
        <>
          {/* New task form */}
          {showTaskForm && (
            <div className={hk.formPanel}>
              <div className={hk.formHeader}>
                <span className={hk.formTitle}>Novi zadatak čišćenja</span>
                <button className={hk.formClose} onClick={() => setShowTaskForm(false)}>✕</button>
              </div>
              <div className={hk.formGrid}>
                <div className={hk.field}>
                  <label>Soba</label>
                  <select value={taskForm.room_id} onChange={e => setTaskForm(f => ({ ...f, room_id: e.target.value }))}>
                    <option value="">— Odaberite sobu —</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>
                        Soba {r.room_number}{r.room_types?.name ? ` (${r.room_types.name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={hk.field}>
                  <label>Tip</label>
                  <select value={taskForm.type} onChange={e => setTaskForm(f => ({ ...f, type: e.target.value }))}>
                    {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                  </select>
                </div>
                <div className={hk.field}>
                  <label>Prioritet</label>
                  <select value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}>
                    {Object.entries(PRIORITY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div className={hk.field}>
                  <label>Dodijeli osobi</label>
                  <select value={taskForm.assigned_to} onChange={e => setTaskForm(f => ({ ...f, assigned_to: e.target.value }))}>
                    <option value="">— Nedodijeljeno —</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                  </select>
                </div>
                <div className={hk.field}>
                  <label>Datum</label>
                  <input type="date" value={taskForm.scheduled_for}
                    onChange={e => setTaskForm(f => ({ ...f, scheduled_for: e.target.value }))} />
                </div>
                <div className={hk.field} style={{ gridColumn: '1 / -1' }}>
                  <label>Napomena</label>
                  <input value={taskForm.notes} onChange={e => setTaskForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Specifični zahtjevi..." />
                </div>
              </div>
              <div className={hk.formActions}>
                <button className={styles.btnSecondary} onClick={() => setShowTaskForm(false)}>Odustani</button>
                <button className={styles.btnPrimary} onClick={handleSaveTask} disabled={saving}>
                  {saving ? 'Kreiranje...' : 'Kreiraj zadatak'}
                </button>
              </div>
            </div>
          )}

          {/* Status filter */}
          <div className={hk.statusFilter}>
            {['all', 'pending', 'in_progress', 'done', 'verified'].map(s => (
              <button
                key={s}
                className={`${hk.filterChip} ${statusFilter === s ? hk.filterChipActive : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === 'all' ? 'Svi' : STATUS_MAP[s]?.icon + ' ' + STATUS_MAP[s]?.label}
              </button>
            ))}
          </div>

          {filteredTasks.length === 0 ? (
            <div className={hk.empty}>
              <div className={hk.emptyIcon}>🧹</div>
              <p>{statusFilter === 'all' ? 'Nema zadataka za odabrani dan.' : 'Nema zadataka u ovom statusu.'}</p>
            </div>
          ) : (
            <div className={hk.taskList}>
              {filteredTasks.map(task => {
                const typeInfo = TASK_TYPES.find(t => t.value === task.type) || TASK_TYPES[0]
                const assignedStaff = staff.find(s => s.id === task.assigned_to)
                return (
                  <div key={task.id} className={`${hk.taskCard} ${task.status === 'done' || task.status === 'verified' ? hk.taskCardDone : ''}`}>
                    <div className={hk.taskCardLeft}>
                      <div className={hk.taskRoomBig}>
                        <span className={hk.taskRoomIcon}>{typeInfo.icon}</span>
                        <div>
                          <div className={hk.taskRoomNum}>Soba {task.rooms?.room_number ?? '—'}</div>
                          <div className={hk.taskRoomType}>{task.rooms?.room_types?.name}</div>
                        </div>
                      </div>
                      <div className={hk.taskType}>{typeInfo.label}</div>
                      {task.notes && <div className={hk.taskNotes}>{task.notes}</div>}
                      <div className={hk.taskMeta}>
                        <PriorityBadge priority={task.priority} />
                        <StatusBadge status={task.status} />
                        {task.completed_at && (
                          <span className={hk.taskTime}>
                            Završeno: {new Date(task.completed_at).toLocaleTimeString('sr-Latn', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={hk.taskCardRight}>
                      {/* Assign */}
                      <select
                        className={hk.assignSelect}
                        value={task.assigned_to || ''}
                        onChange={e => handleAssign(task.id, e.target.value)}
                      >
                        <option value="">Nedodijeljeno</option>
                        {staff.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                      </select>

                      {/* Status actions */}
                      <div className={hk.taskActions}>
                        {task.status === 'pending' && (
                          <button className={hk.btnStart}
                            onClick={() => handleTaskStatusChange(task, 'in_progress')}>
                            ▶ Počni
                          </button>
                        )}
                        {task.status === 'in_progress' && (
                          <button className={hk.btnDone}
                            onClick={() => handleTaskStatusChange(task, 'done')}>
                            ✓ Završi
                          </button>
                        )}
                        {task.status === 'done' && (
                          <button className={hk.btnVerify}
                            onClick={() => handleTaskStatusChange(task, 'verified')}>
                            ⭐ Verifikuj
                          </button>
                        )}
                        {task.status === 'verified' && (
                          <span className={hk.verifiedLabel}>Verifikovano ✓</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── MAINTENANCE TAB ── */}
      {!loading && tab === 'maintenance' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button className={styles.btnPrimary}
              onClick={() => { setShowMaintForm(true); setShowTaskForm(false) }}>
              + Novi zahtjev
            </button>
          </div>

          {/* Maint form */}
          {showMaintForm && (
            <div className={hk.formPanel}>
              <div className={hk.formHeader}>
                <span className={hk.formTitle}>Novi zahtjev za održavanje</span>
                <button className={hk.formClose} onClick={() => setShowMaintForm(false)}>✕</button>
              </div>
              <div className={hk.formGrid}>
                <div className={hk.field}>
                  <label>Soba (opciono)</label>
                  <select value={maintForm.room_id} onChange={e => setMaintForm(f => ({ ...f, room_id: e.target.value }))}>
                    <option value="">— Opšti prostor —</option>
                    {rooms.map(r => <option key={r.id} value={r.id}>Soba {r.room_number}</option>)}
                  </select>
                </div>
                <div className={hk.field}>
                  <label>Kategorija</label>
                  <select value={maintForm.category} onChange={e => setMaintForm(f => ({ ...f, category: e.target.value }))}>
                    {MAINT_CATS.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                  </select>
                </div>
                <div className={hk.field}>
                  <label>Prioritet</label>
                  <select value={maintForm.priority} onChange={e => setMaintForm(f => ({ ...f, priority: e.target.value }))}>
                    {Object.entries(PRIORITY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div className={hk.field} style={{ gridColumn: '1 / -1' }}>
                  <label>Opis problema *</label>
                  <input value={maintForm.description}
                    onChange={e => setMaintForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Opišite problem..." />
                </div>
              </div>
              <div className={hk.formActions}>
                <button className={styles.btnSecondary} onClick={() => setShowMaintForm(false)}>Odustani</button>
                <button className={styles.btnPrimary} onClick={handleSaveMaint} disabled={saving}>
                  {saving ? 'Kreiranje...' : 'Prijavi problem'}
                </button>
              </div>
            </div>
          )}

          {maintenance.length === 0 ? (
            <div className={hk.empty}>
              <div className={hk.emptyIcon}>🔧</div>
              <p>Nema otvorenih zahtjeva za održavanje.</p>
            </div>
          ) : (
            <div className={hk.maintList}>
              {maintenance.map(m => {
                const cat = MAINT_CATS.find(c => c.value === m.category) || MAINT_CATS[5]
                return (
                  <div key={m.id} className={hk.maintCard}>
                    <div className={hk.maintIcon}>{cat.icon}</div>
                    <div className={hk.maintBody}>
                      <div className={hk.maintTitle}>{m.description}</div>
                      <div className={hk.maintMeta}>
                        {m.rooms?.room_number && <span>Soba {m.rooms.room_number}</span>}
                        <span>{cat.label}</span>
                        <PriorityBadge priority={m.priority} />
                        <span className={hk.maintDate}>
                          {new Date(m.created_at).toLocaleDateString('sr-Latn')}
                        </span>
                        {m.staff && <span>{m.staff.first_name} {m.staff.last_name}</span>}
                      </div>
                    </div>
                    <div className={hk.maintActions}>
                      {m.status === 'open' && (
                        <button className={hk.btnStart}
                          onClick={() => handleMaintStatus(m.id, 'in_progress')}>U rad</button>
                      )}
                      {m.status === 'in_progress' && (
                        <button className={hk.btnDone}
                          onClick={() => handleMaintStatus(m.id, 'resolved')}>Riješeno</button>
                      )}
                      <span className={hk.maintStatus}
                        style={{ color: m.status === 'open' ? '#e67e22' : m.status === 'in_progress' ? '#2563eb' : '#0d7a52' }}>
                        {m.status === 'open' ? 'Otvoreno' : m.status === 'in_progress' ? 'U toku' : 'Riješeno'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
