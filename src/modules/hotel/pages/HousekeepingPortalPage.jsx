import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import styles from './HousekeepingPortal.module.css'

const TODAY = new Date().toISOString().slice(0, 10)

const TASK_TYPES = {
  checkout_clean: { label: 'Checkout čišćenje', icon: '🚪' },
  stayover_clean: { label: 'Svakodnevno čišćenje', icon: '🧹' },
  turndown:       { label: 'Turndown servis', icon: '🌙' },
  inspection:     { label: 'Inspekcija', icon: '🔍' },
  deep_clean:     { label: 'Dubinsko čišćenje', icon: '✨' },
}

const PRIORITY_COLOR = { urgent: '#c0392b', high: '#e67e22', normal: '#0d7a52', low: '#8a9e96' }
const PRIORITY_LABEL = { urgent: 'HITNO', high: 'Visok', normal: 'Normalan', low: 'Nizak' }

const MAINT_CATS = [
  { value: 'plumbing',   label: 'Vodoinstalacije', icon: '🔧' },
  { value: 'electrical', label: 'Elektrika',        icon: '⚡' },
  { value: 'ac',         label: 'Klima',            icon: '❄️' },
  { value: 'furniture',  label: 'Namještaj',         icon: '🪑' },
  { value: 'internet',   label: 'Internet / TV',    icon: '📡' },
  { value: 'other',      label: 'Ostalo',           icon: '🔩' },
]

const TODAY_LABEL = new Date().toLocaleDateString('sr-Latn', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
})

export default function HousekeepingPortalPage() {
  const { slug } = useParams()

  const [restaurant, setRestaurant] = useState(null)
  const [loadingRest, setLoadingRest] = useState(true)

  // Auth
  const [mode, setMode] = useState('login') // login | portal
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // Staff & tasks
  const [staffMember, setStaffMember] = useState(null)
  const [tasks, setTasks] = useState([])
  const [rooms, setRooms] = useState([])
  const [tasksLoading, setTasksLoading] = useState(false)

  // Maintenance form
  const [showMaint, setShowMaint] = useState(false)
  const [maintForm, setMaintForm] = useState({ room_id: '', category: 'other', description: '' })
  const [maintSaving, setMaintSaving] = useState(false)
  const [maintDone, setMaintDone] = useState(false)

  // Load restaurant
  useEffect(() => {
    supabase.from('restaurants').select('id, name, logo_url, slug')
      .ilike('slug', slug).single()
      .then(({ data }) => { setRestaurant(data); setLoadingRest(false) })
  }, [slug])

  // Check existing session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && restaurant) loadStaffPortal(session.user.id)
    })
  }, [restaurant])

  const loadStaffPortal = async (userId) => {
    if (!restaurant) return
    setTasksLoading(true)
    const { data: s } = await supabase.from('staff')
      .select('id, first_name, last_name, role')
      .eq('user_id', userId)
      .eq('restaurant_id', restaurant.id)
      .single()

    if (!s) { setAuthError('Niste pronađeni kao osoblje ovog objekta.'); setTasksLoading(false); return }
    setStaffMember(s)

    const [{ data: t }, { data: r }] = await Promise.all([
      supabase.from('housekeeping_tasks')
        .select('*, rooms(id, room_number, room_types(name))')
        .eq('restaurant_id', restaurant.id)
        .eq('assigned_to', s.id)
        .eq('scheduled_for', TODAY)
        .order('priority', { ascending: false }),
      supabase.from('rooms')
        .select('id, room_number')
        .eq('restaurant_id', restaurant.id)
        .order('room_number'),
    ])

    setTasks(t ?? [])
    setRooms(r ?? [])
    setTasksLoading(false)
    setMode('portal')
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) {
      setAuthError('Pogrešan email ili lozinka.')
      setAuthLoading(false)
      return
    }
    await loadStaffPortal(data.user.id)
    setAuthLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setMode('login')
    setStaffMember(null)
    setTasks([])
    setEmail('')
    setPassword('')
  }

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
      restaurant_id: restaurant.id,
      reported_by: staffMember.id,
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

  // ── Loading ──
  if (loadingRest) {
    return (
      <div className={styles.loadWrap}>
        <div className={styles.spinner} />
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className={styles.loadWrap}>
        <p className={styles.notFound}>Objekat nije pronađen.</p>
      </div>
    )
  }

  // ── Login screen ──
  if (mode === 'login') {
    return (
      <div className={styles.loginPage}>
        <div className={styles.loginCard}>
          {restaurant.logo_url && (
            <img src={restaurant.logo_url} alt={restaurant.name} className={styles.loginLogo} />
          )}
          <h1 className={styles.loginTitle}>{restaurant.name}</h1>
          <p className={styles.loginSub}>🧹 Portal osoblja — Domaćinstvo</p>

          <form onSubmit={handleLogin} className={styles.loginForm}>
            <input
              type="email"
              className={styles.loginInput}
              placeholder="Email adresa"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <input
              type="password"
              className={styles.loginInput}
              placeholder="Lozinka"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            {authError && <p className={styles.loginError}>{authError}</p>}
            <button type="submit" className={styles.loginBtn} disabled={authLoading}>
              {authLoading ? 'Prijava...' : 'Prijavi se'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Portal screen ──
  const pending     = tasks.filter(t => t.status === 'pending').length
  const inProgress  = tasks.filter(t => t.status === 'in_progress').length
  const done        = tasks.filter(t => t.status === 'done' || t.status === 'verified').length

  return (
    <div className={styles.portalPage}>
      {/* Header */}
      <div className={styles.portalHeader}>
        <div>
          <div className={styles.portalName}>{staffMember.first_name} {staffMember.last_name}</div>
          <div className={styles.portalDate}>{TODAY_LABEL}</div>
        </div>
        <button className={styles.logoutBtn} onClick={handleLogout}>Odjava</button>
      </div>

      {/* Stats bar */}
      <div className={styles.statsBar}>
        <div className={styles.statItem}>
          <div className={styles.statNum} style={{ color: '#e67e22' }}>{pending}</div>
          <div className={styles.statLbl}>Čeka</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statNum} style={{ color: '#2563eb' }}>{inProgress}</div>
          <div className={styles.statLbl}>U toku</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statNum} style={{ color: '#0d7a52' }}>{done}</div>
          <div className={styles.statLbl}>Završeno</div>
        </div>
      </div>

      {/* Tasks */}
      {tasksLoading ? (
        <div className={styles.loadWrap}><div className={styles.spinner} /></div>
      ) : tasks.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>✅</div>
          <p>Nemate zadataka za danas.</p>
        </div>
      ) : (
        <div className={styles.taskList}>
          {tasks.map(task => {
            const typeInfo = TASK_TYPES[task.type] || TASK_TYPES.stayover_clean
            const isDone = task.status === 'done' || task.status === 'verified'
            return (
              <div
                key={task.id}
                className={`${styles.taskCard} ${isDone ? styles.taskCardDone : ''}`}
              >
                {/* Priority strip */}
                <div
                  className={styles.priorityStrip}
                  style={{ background: PRIORITY_COLOR[task.priority] || PRIORITY_COLOR.normal }}
                />

                <div className={styles.taskBody}>
                  <div className={styles.taskRoom}>
                    <span className={styles.taskIcon}>{typeInfo.icon}</span>
                    <div>
                      <div className={styles.taskRoomNum}>
                        Soba {task.rooms?.room_number ?? '—'}
                      </div>
                      {task.rooms?.room_types?.name && (
                        <div className={styles.taskRoomType}>{task.rooms.room_types.name}</div>
                      )}
                    </div>
                    {task.priority === 'urgent' && (
                      <span className={styles.urgentBadge}>HITNO</span>
                    )}
                  </div>

                  <div className={styles.taskTypeLabel}>{typeInfo.label}</div>
                  {task.notes && <div className={styles.taskNotes}>{task.notes}</div>}

                  {/* Action button */}
                  <div className={styles.taskActionRow}>
                    {task.status === 'pending' && (
                      <button
                        className={`${styles.actionBtn} ${styles.actionBtnStart}`}
                        onClick={() => updateStatus(task.id, 'in_progress')}
                      >
                        ▶ Počni
                      </button>
                    )}
                    {task.status === 'in_progress' && (
                      <button
                        className={`${styles.actionBtn} ${styles.actionBtnDone}`}
                        onClick={() => updateStatus(task.id, 'done')}
                      >
                        ✓ Završi
                      </button>
                    )}
                    {isDone && (
                      <span className={styles.doneLabel}>✅ Završeno</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Maintenance report */}
      <div className={styles.maintSection}>
        {!showMaint ? (
          <button className={styles.maintToggleBtn} onClick={() => setShowMaint(true)}>
            🔧 Prijavi kvar ili problem
          </button>
        ) : (
          <form onSubmit={handleMaintSubmit} className={styles.maintForm}>
            <div className={styles.maintFormHeader}>
              <span className={styles.maintFormTitle}>Prijava problema</span>
              <button type="button" className={styles.maintFormClose} onClick={() => setShowMaint(false)}>✕</button>
            </div>

            <select
              className={styles.maintSelect}
              value={maintForm.room_id}
              onChange={e => setMaintForm(f => ({ ...f, room_id: e.target.value }))}
            >
              <option value="">— Soba (opcionalno) —</option>
              {rooms.map(r => <option key={r.id} value={r.id}>Soba {r.room_number}</option>)}
            </select>

            <select
              className={styles.maintSelect}
              value={maintForm.category}
              onChange={e => setMaintForm(f => ({ ...f, category: e.target.value }))}
            >
              {MAINT_CATS.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
            </select>

            <textarea
              className={styles.maintTextarea}
              placeholder="Opišite problem..."
              value={maintForm.description}
              onChange={e => setMaintForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              required
            />

            {maintDone ? (
              <div className={styles.maintSuccess}>✅ Problem prijavljen!</div>
            ) : (
              <button type="submit" className={styles.maintSubmitBtn} disabled={maintSaving}>
                {maintSaving ? 'Slanje...' : 'Pošalji prijavu'}
              </button>
            )}
          </form>
        )}
      </div>

      <footer className={styles.portalFooter}>
        Powered by <strong>SmartMeni</strong>
      </footer>
    </div>
  )
}
