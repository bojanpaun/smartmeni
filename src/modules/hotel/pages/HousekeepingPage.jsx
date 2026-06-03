import { useState } from 'react'
import { usePlatform } from '../../../context/PlatformContext'
import { useAdminBadgeRefresh } from '../../../layouts/AdminLayout'
import { useHousekeeping } from '../hooks/useHousekeeping'
import { useRooms } from '../hooks/useRooms'
import { supabase } from '../../../lib/supabase'
import DateNav, { DATE_TODAY } from '../../../components/shared/DateNav'
import SortableHead from '../../../components/shared/SortableHead'
import { useSortable } from '../../../hooks/useSortable'
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
  pending:     { label: 'Na čekanju',   icon: '⏳', color: 'var(--c-danger)',  bg: 'var(--c-danger-bg)' },
  in_progress: { label: 'U toku',       icon: '🔄', color: 'var(--c-warning)', bg: 'var(--c-warning-bg)' },
  done:        { label: 'Završeno',     icon: '✅', color: 'var(--c-primary)', bg: 'var(--c-primary-light)' },
  verified:    { label: 'Verifikovano', icon: '⭐', color: '#7c3aed',           bg: 'rgba(124,58,237,0.12)' },
}

const MAINT_STATUS_MAP = {
  open:        { label: 'Otvoreno',     icon: '🔧', color: 'var(--c-danger)',  bg: 'var(--c-danger-bg)' },
  in_progress: { label: 'U toku',       icon: '🔄', color: 'var(--c-warning)', bg: 'var(--c-warning-bg)' },
  done:        { label: 'Završeno',     icon: '✅', color: 'var(--c-primary)', bg: 'var(--c-primary-light)' },
  verified:    { label: 'Verifikovano', icon: '⭐', color: '#7c3aed',           bg: 'rgba(124,58,237,0.12)' },
  resolved:    { label: 'Riješeno',     icon: '✓',  color: 'var(--c-text-muted)', bg: 'var(--c-bg-subtle)' },
}

function MaintStatusBadge({ status }) {
  const s = MAINT_STATUS_MAP[status] || MAINT_STATUS_MAP.open
  return <span className={hk.statusBadge} style={{ color: s.color, background: s.bg }}>{s.icon} {s.label}</span>
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
  return <span className={hk.statusBadge} style={{ color: s.color, background: s.bg }}>{s.icon} {s.label}</span>
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
  const { refreshCounts } = useAdminBadgeRefresh()
  const [from, setFrom] = useState(DATE_TODAY)
  const [to, setTo] = useState(DATE_TODAY)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('tasks')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [maintStatusFilter, setMaintStatusFilter] = useState('open')
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showMaintForm, setShowMaintForm] = useState(false)
  const [taskForm, setTaskForm] = useState(BLANK_TASK)
  const [maintForm, setMaintForm] = useState(BLANK_MAINT)
  const [saving, setSaving] = useState(false)

  const { tasks, maintenance, staff, loading, refetch, updateTaskStatus, assignTask } = useHousekeeping(restaurant?.id, from, to, refreshCounts)
  const taskSort = useSortable('scheduled_for')
  const maintSort = useSortable('created_at', 'desc')
  const { rooms } = useRooms(restaurant?.id)

  if (!restaurant) return <LoadingSpinner fullPage />

  // Stats
  const pending    = tasks.filter(t => t.status === 'pending').length
  const inProgress = tasks.filter(t => t.status === 'in_progress').length
  const done       = tasks.filter(t => t.status === 'done').length
  const verified   = tasks.filter(t => t.status === 'verified').length
  const maintOpen       = maintenance.filter(m => m.status === 'open').length
  const maintInProgress = maintenance.filter(m => m.status === 'in_progress').length
  const maintDone       = maintenance.filter(m => m.status === 'done').length
  const maintVerified   = maintenance.filter(m => m.status === 'verified').length

  const filteredMaintenance = maintenance.filter(m => {
    const matchStatus = maintStatusFilter === 'all' || m.status === maintStatusFilter
    if (!search) return matchStatus
    const q = search.toLowerCase()
    const matchSearch = (
      (m.description || '').toLowerCase().includes(q) ||
      String(m.rooms?.room_number || '').toLowerCase().includes(q)
    )
    return matchStatus && matchSearch
  })

  const filteredTasks = tasks.filter(t => {
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    if (!search) return matchStatus
    const q = search.toLowerCase()
    const staffName = staff.find(s => s.id === t.assigned_to)
    const staffStr = staffName ? `${staffName.first_name} ${staffName.last_name}`.toLowerCase() : ''
    const matchSearch = (
      String(t.rooms?.room_number || '').toLowerCase().includes(q) ||
      (t.notes || '').toLowerCase().includes(q) ||
      staffStr.includes(q)
    )
    return matchStatus && matchSearch
  })

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
    if (!error && maintForm.room_id) {
      await supabase.from('rooms').update({ status: 'maintenance' }).eq('id', maintForm.room_id)
    }
    setSaving(false)
    if (error) return toast.error('Greška pri kreiranju zahtjeva')
    toast.success('Zahtjev kreiran — soba postavljena na servis')
    setShowMaintForm(false)
    setMaintForm(BLANK_MAINT)
    refetch()
  }

  const handleMaintStatus = async (id, status) => {
    const patch = { status, updated_at: new Date().toISOString() }
    if (status === 'verified') patch.resolved_at = new Date().toISOString()
    await supabase.from('maintenance_requests').update(patch).eq('id', id)
    if (status === 'verified') {
      const m = maintenance.find(x => x.id === id)
      if (m?.room_id) {
        await supabase.from('rooms').update({ status: 'available' }).eq('id', m.room_id)
      }
    }
    const labels = { in_progress: 'U toku', done: 'Završeno', verified: 'Verifikovano — soba dostupna' }
    toast.success(labels[status] || 'Status ažuriran')
    refetch()
    refreshCounts()
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
          <button className={styles.btnSecondary}
            onClick={() => { setTab('tasks'); setShowTaskForm(true); setShowMaintForm(false) }}>
            + Novo čišćenje
          </button>
          <button className={styles.btnSecondary}
            onClick={() => { setTab('maintenance'); setShowMaintForm(true); setShowTaskForm(false) }}>
            + Novo održavanje
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className={hk.statsGroup}>
        <div className={hk.statsSection}>
          <div className={hk.statsSectionLabel}>🧹 Čišćenje</div>
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
          </div>
        </div>
        <div className={hk.statsSection}>
          <div className={hk.statsSectionLabel}>🔧 Održavanje</div>
          <div className={hk.stats}>
            <div className={hk.stat}>
              <div className={hk.statVal} style={{ color: '#e67e22' }}>{maintOpen}</div>
              <div className={hk.statLabel}>Otvoreno</div>
            </div>
            <div className={hk.stat}>
              <div className={hk.statVal} style={{ color: '#2563eb' }}>{maintInProgress}</div>
              <div className={hk.statLabel}>U toku</div>
            </div>
            <div className={hk.stat}>
              <div className={hk.statVal} style={{ color: '#0d7a52' }}>{maintDone}</div>
              <div className={hk.statLabel}>Završeno</div>
            </div>
            <div className={hk.stat}>
              <div className={hk.statVal} style={{ color: '#7c3aed' }}>{maintVerified}</div>
              <div className={hk.statLabel}>Verifikovano</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.filterBar} style={{ marginBottom: 8 }}>
        <button className={`${styles.filterBtn} ${tab === 'tasks' ? styles.filterBtnActive : ''}`}
          onClick={() => setTab('tasks')}>
          Zadaci čišćenja <span className={styles.filterCount}>{tasks.length}</span>
        </button>
        <button className={`${styles.filterBtn} ${tab === 'maintenance' ? styles.filterBtnActive : ''}`}
          onClick={() => setTab('maintenance')}>
          Održavanje <span className={styles.filterCount}>{maintenance.length}</span>
        </button>
      </div>

      {/* DateNav — visible for both tabs */}
      <DateNav
        from={from}
        to={to}
        search={search}
        onChange={(f, t) => { setFrom(f); setTo(t) }}
        onSearch={setSearch}
        showFuture={true}
        showMonth={true}
        allowAll={true}
        placeholder="Pretraži sobu, osoblje..."
      />

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
            {[
              { key: 'pending',     ...STATUS_MAP.pending,     count: pending },
              { key: 'in_progress', ...STATUS_MAP.in_progress, count: inProgress },
              { key: 'done',        ...STATUS_MAP.done,        count: done },
              { key: 'verified',    ...STATUS_MAP.verified,    count: verified },
              { key: 'all',         label: 'Svi',   count: tasks.length },
            ].map(s => (
              <button key={s.key}
                className={`${hk.filterChip} ${statusFilter === s.key ? hk.filterChipActive : ''}`}
                onClick={() => setStatusFilter(s.key)}
              >
                {s.icon ? `${s.icon} ${s.label}` : s.label}
                <span className={hk.chipCount} style={s.color ? { background: s.bg, color: s.color } : {}}>{s.count}</span>
              </button>
            ))}
          </div>

          {filteredTasks.length === 0 ? (
            <div className={hk.empty}>
              <div className={hk.emptyIcon}>🧹</div>
              <p>{statusFilter === 'all' ? 'Nema zadataka za odabrani period.' : 'Nema zadataka u ovom statusu.'}</p>
            </div>
          ) : (<>
            {/* Desktop */}
            <div className={styles.fdDesktopTable}>
              <div className={styles.table} style={{ overflowX: 'auto' }}>
                <div className={styles.tableHead} style={{ gridTemplateColumns: '2fr 1fr 90px 1.5fr 90px 120px 180px' }}>
                  <SortableHead col="rooms.room_number" label="Soba"      sortBy={taskSort.sortBy} sortDir={taskSort.sortDir} onSort={taskSort.onSort} />
                  <SortableHead col="type"              label="Tip"       sortBy={taskSort.sortBy} sortDir={taskSort.sortDir} onSort={taskSort.onSort} />
                  <SortableHead col="scheduled_for"     label="Datum"     sortBy={taskSort.sortBy} sortDir={taskSort.sortDir} onSort={taskSort.onSort} />
                  <span>Dodijeljeno</span>
                  <SortableHead col="priority"          label="Prioritet" sortBy={taskSort.sortBy} sortDir={taskSort.sortDir} onSort={taskSort.onSort} />
                  <SortableHead col="status"            label="Status"    sortBy={taskSort.sortBy} sortDir={taskSort.sortDir} onSort={taskSort.onSort} />
                  <span></span>
                </div>
                {taskSort.sort(filteredTasks).map(task => {
                  const typeInfo = TASK_TYPES.find(t => t.value === task.type) || TASK_TYPES[0]
                  return (
                    <div key={task.id} className={styles.tableRow}
                      style={{ gridTemplateColumns: '2fr 1fr 90px 1.5fr 90px 120px 180px', opacity: task.status === 'verified' ? 0.65 : 1 }}>
                      <span>
                        <span className={styles.bold}>{typeInfo.icon} Soba {task.rooms?.room_number ?? '—'}</span>
                        {task.rooms?.room_types?.name && <span style={{ color: 'var(--c-text-muted)', fontSize: 12, display: 'block' }}>{task.rooms.room_types.name}</span>}
                        {task.notes && <span style={{ color: 'var(--c-text-muted)', fontSize: 12, display: 'block', fontStyle: 'italic' }}>{task.notes}</span>}
                      </span>
                      <span>{typeInfo.label}</span>
                      <span style={{ fontSize: 13 }}>{new Date(task.scheduled_for).toLocaleDateString('sr-Latn', { day: '2-digit', month: '2-digit' })}</span>
                      <span>
                        <select style={{ width: '100%', fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text)' }}
                          value={task.assigned_to || ''} onChange={e => handleAssign(task.id, e.target.value)}>
                          <option value="">Nedodijeljeno</option>
                          {staff.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                        </select>
                      </span>
                      <span><PriorityBadge priority={task.priority} /></span>
                      <span><StatusBadge status={task.status} /></span>
                      <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {task.status === 'pending'     && <button className={hk.btnStart}  onClick={() => handleTaskStatusChange(task, 'in_progress')}>▶ Počni</button>}
                        {task.status === 'in_progress' && <button className={hk.btnDone}   onClick={() => handleTaskStatusChange(task, 'done')}>✓ Završi</button>}
                        {task.status === 'done'        && <button className={hk.btnVerify} onClick={() => handleTaskStatusChange(task, 'verified')}>⭐ Verifikuj</button>}
                        {task.status === 'verified'    && <span className={hk.verifiedLabel}>Verifikovano ✓</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
            {/* Mobile */}
            <div className={styles.fdMobileList}>
              {taskSort.sort(filteredTasks).map(task => {
                const typeInfo = TASK_TYPES.find(t => t.value === task.type) || TASK_TYPES[0]
                const p = PRIORITY_MAP[task.priority] || PRIORITY_MAP.normal
                const st = STATUS_MAP[task.status] || STATUS_MAP.pending
                return (
                  <div key={task.id} className={styles.fdCard} style={{ opacity: task.status === 'verified' ? 0.65 : 1 }}>
                    <div className={styles.fdCardTop}>
                      <div className={styles.fdCardGuest}>{typeInfo.icon} Soba {task.rooms?.room_number ?? '—'}</div>
                      <span className={styles.fdCardStatus} style={{ background: p.bg, color: p.color }}>{p.label}</span>
                    </div>
                    <div className={styles.fdCardMeta}>
                      <span>{typeInfo.label}</span>
                      <span>{new Date(task.scheduled_for).toLocaleDateString('sr-Latn', { day: '2-digit', month: '2-digit' })}</span>
                      <span className={styles.fdCardStatus} style={{ background: st.bg, color: st.color }}>{st.icon} {st.label}</span>
                    </div>
                    {task.notes && <div className={styles.fdCardMsg}>{task.notes}</div>}
                    <select style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text)', width: '100%' }}
                      value={task.assigned_to || ''} onChange={e => handleAssign(task.id, e.target.value)}>
                      <option value="">Nedodijeljeno</option>
                      {staff.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                    </select>
                    <div className={styles.fdCardActions}>
                      {task.status === 'pending'     && <button className={hk.btnStart}  onClick={() => handleTaskStatusChange(task, 'in_progress')}>▶ Počni</button>}
                      {task.status === 'in_progress' && <button className={hk.btnDone}   onClick={() => handleTaskStatusChange(task, 'done')}>✓ Završi</button>}
                      {task.status === 'done'        && <button className={hk.btnVerify} onClick={() => handleTaskStatusChange(task, 'verified')}>⭐ Verifikuj</button>}
                      {task.status === 'verified'    && <span className={hk.verifiedLabel}>⭐ Verifikovano</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </>)}
        </>
      )}

      {/* ── MAINTENANCE TAB ── */}
      {!loading && tab === 'maintenance' && (
        <>
          {/* Status filter chips */}
          <div className={hk.statusFilter} style={{ marginBottom: 14 }}>
            {[
              { key: 'open',        ...MAINT_STATUS_MAP.open,        count: maintOpen },
              { key: 'in_progress', ...MAINT_STATUS_MAP.in_progress, count: maintInProgress },
              { key: 'done',        ...MAINT_STATUS_MAP.done,        count: maintDone },
              { key: 'verified',    ...MAINT_STATUS_MAP.verified,    count: maintVerified },
              { key: 'all',         label: 'Svi',   icon: null,  count: maintenance.length },
            ].map(s => (
              <button key={s.key}
                className={`${hk.filterChip} ${maintStatusFilter === s.key ? hk.filterChipActive : ''}`}
                onClick={() => setMaintStatusFilter(s.key)}
              >
                {s.icon ? `${s.icon} ${s.label}` : s.label}
                <span className={hk.chipCount} style={s.color ? { background: s.bg, color: s.color } : {}}>{s.count}</span>
              </button>
            ))}
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

          {filteredMaintenance.length === 0 ? (
            <div className={hk.empty}>
              <div className={hk.emptyIcon}>🔧</div>
              <p>{maintStatusFilter === 'all' ? 'Nema zahtjeva za održavanje.' : `Nema zahtjeva u statusu "${MAINT_STATUS_MAP[maintStatusFilter]?.label}".`}</p>
            </div>
          ) : (<>
            {/* Desktop */}
            <div className={styles.fdDesktopTable}>
              <div className={styles.table} style={{ overflowX: 'auto' }}>
                <div className={styles.tableHead} style={{ gridTemplateColumns: '3fr 80px 1fr 90px 130px 180px' }}>
                  <SortableHead col="description"       label="Opis"       sortBy={maintSort.sortBy} sortDir={maintSort.sortDir} onSort={maintSort.onSort} />
                  <SortableHead col="rooms.room_number" label="Soba"       sortBy={maintSort.sortBy} sortDir={maintSort.sortDir} onSort={maintSort.onSort} />
                  <SortableHead col="category"          label="Kategorija" sortBy={maintSort.sortBy} sortDir={maintSort.sortDir} onSort={maintSort.onSort} />
                  <SortableHead col="priority"          label="Prioritet"  sortBy={maintSort.sortBy} sortDir={maintSort.sortDir} onSort={maintSort.onSort} />
                  <SortableHead col="status"            label="Status"     sortBy={maintSort.sortBy} sortDir={maintSort.sortDir} onSort={maintSort.onSort} />
                  <span></span>
                </div>
                {maintSort.sort(filteredMaintenance).map(m => {
                  const cat = MAINT_CATS.find(c => c.value === m.category) || MAINT_CATS[5]
                  return (
                    <div key={m.id} className={styles.tableRow}
                      style={{ gridTemplateColumns: '3fr 80px 1fr 90px 130px 180px', opacity: m.status === 'verified' ? 0.65 : 1 }}>
                      <span>
                        <span className={styles.bold}>{m.description}</span>
                        <span style={{ color: 'var(--c-text-muted)', fontSize: 12, display: 'block' }}>
                          {new Date(m.created_at).toLocaleDateString('sr-Latn')}
                          {m.staff && ` · ${m.staff.first_name} ${m.staff.last_name}`}
                        </span>
                      </span>
                      <span style={{ fontSize: 13 }}>{m.rooms?.room_number ? `Soba ${m.rooms.room_number}` : <span style={{ color: 'var(--c-text-muted)' }}>Opšti</span>}</span>
                      <span style={{ fontSize: 13 }}>{cat.icon} {cat.label}</span>
                      <span><PriorityBadge priority={m.priority} /></span>
                      <span><MaintStatusBadge status={m.status} /></span>
                      <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {m.status === 'open'        && <button className={hk.btnStart}  onClick={() => handleMaintStatus(m.id, 'in_progress')}>▶ U rad</button>}
                        {m.status === 'in_progress' && <button className={hk.btnDone}   onClick={() => handleMaintStatus(m.id, 'done')}>✓ Završi</button>}
                        {m.status === 'done'        && <button className={hk.btnVerify} onClick={() => handleMaintStatus(m.id, 'verified')}>⭐ Verifikuj</button>}
                        {m.status === 'verified'    && <span className={hk.verifiedLabel}>Verifikovano ✓</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
            {/* Mobile */}
            <div className={styles.fdMobileList}>
              {maintSort.sort(filteredMaintenance).map(m => {
                const cat = MAINT_CATS.find(c => c.value === m.category) || MAINT_CATS[5]
                const p = PRIORITY_MAP[m.priority] || PRIORITY_MAP.normal
                const st = MAINT_STATUS_MAP[m.status] || MAINT_STATUS_MAP.open
                return (
                  <div key={m.id} className={styles.fdCard} style={{ opacity: m.status === 'verified' ? 0.65 : 1 }}>
                    <div className={styles.fdCardTop}>
                      <div className={styles.fdCardGuest}>{cat.icon} {m.description}</div>
                      <span className={styles.fdCardStatus} style={{ background: st.bg, color: st.color }}>{st.icon} {st.label}</span>
                    </div>
                    <div className={styles.fdCardMeta}>
                      <span>{m.rooms?.room_number ? `Soba ${m.rooms.room_number}` : 'Opšti prostor'}</span>
                      <span className={styles.fdCardStatus} style={{ background: p.bg, color: p.color }}>{p.label}</span>
                      <span>{new Date(m.created_at).toLocaleDateString('sr-Latn')}</span>
                    </div>
                    {m.staff && <div className={styles.fdCardMsg}>Prijavio/la: {m.staff.first_name} {m.staff.last_name}</div>}
                    <div className={styles.fdCardActions}>
                      {m.status === 'open'        && <button className={hk.btnStart}  onClick={() => handleMaintStatus(m.id, 'in_progress')}>▶ U rad</button>}
                      {m.status === 'in_progress' && <button className={hk.btnDone}   onClick={() => handleMaintStatus(m.id, 'done')}>✓ Završi</button>}
                      {m.status === 'done'        && <button className={hk.btnVerify} onClick={() => handleMaintStatus(m.id, 'verified')}>⭐ Verifikuj</button>}
                      {m.status === 'verified'    && <span className={hk.verifiedLabel}>⭐ Verifikovano</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </>)}
        </>
      )}
    </div>
  )
}
