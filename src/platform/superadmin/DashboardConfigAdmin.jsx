import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'
import { MODULES } from '../../layouts/AdminLayout'
import { getAllPermissions } from '../../lib/permissions'
import { translateLibraries } from '../../lib/contentTranslate'
import { logAudit } from '../../lib/auditLog'
import styles from './DashboardConfigAdmin.module.css'

const VERTICALS = ['restaurant', 'hotel', 'rental']
const EMOJIS = ['⚡', '➕', '💶', '📊', '📱', '👤', '📅', '🧾', '🍽️', '🪑', '🏨', '💆', '⚙️', '🔔', '📦', '🎟️']

// Poznate admin putanje (iz MODULES) za datalist — superadmin bira umjesto da kuca
// (manje grešaka). Slobodan unos i dalje moguć (datalist je sugestija, ne ograničenje).
function knownPaths() {
  const out = new Map()
  for (const m of MODULES) {
    if (m.path) out.set(m.path, m.labelKey)
    for (const seg of [m.interactive, m.admin]) {
      for (const l of seg?.links ?? []) if (l.path) out.set(l.path, l.labelKey)
    }
  }
  // Dodatne česte rute koje nisu u MODULES linkovima.
  out.set('/admin/orders', 'navOrders')
  out.set('/admin/reservations', 'navReservations')
  out.set('/admin/hr/staff', 'navStaff')
  return [...out.entries()].map(([path, labelKey]) => ({ path, labelKey }))
}

const blankRow = () => ({ id: null, sort_order: 0, icon: '⚡', label: '', path: '', vertical: '', perm: '', addon: '', is_active: true })

export default function DashboardConfigAdmin() {
  const { t } = useTranslation('admin')
  const { isSuperAdmin } = usePlatform()
  const [rows, setRows] = useState([])
  const [addons, setAddons] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [transBusy, setTransBusy] = useState(false)

  const paths = useMemo(() => knownPaths(), [])
  const perms = useMemo(() => getAllPermissions(), [])

  const load = async () => {
    setLoading(true)
    const [{ data: tasks }, { data: cat }] = await Promise.all([
      supabase.from('dashboard_tasks')
        .select('id, sort_order, icon, label, path, vertical, perm, addon, is_active')
        .order('sort_order', { ascending: true }),
      supabase.from('addon_catalog').select('id, name').order('name'),
    ])
    setRows((tasks ?? []).map(r => ({ ...r, vertical: r.vertical ?? '', perm: r.perm ?? '', addon: r.addon ?? '' })))
    setAddons(cat ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const setField = (idx, field, value) =>
    setRows(rs => rs.map((r, i) => i === idx ? { ...r, [field]: value } : r))

  const addRow = () => {
    const nextSort = rows.length ? Math.max(...rows.map(r => r.sort_order || 0)) + 10 : 10
    setRows(rs => [...rs, { ...blankRow(), sort_order: nextSort }])
  }

  const saveRow = async (idx) => {
    const r = rows[idx]
    if (!r.label.trim() || !r.path.trim()) { toast.error(t('saDashReqFields')); return }
    setSavingId(idx)
    // Prazne gating vrijednosti → NULL (nema gating-a za to polje).
    const payload = {
      sort_order: Number(r.sort_order) || 0,
      icon: r.icon || '⚡',
      label: r.label.trim(),
      path: r.path.trim(),
      vertical: r.vertical || null,
      perm: r.perm || null,
      addon: r.addon || null,
      is_active: !!r.is_active,
    }
    let error, savedId = r.id
    if (r.id) {
      ({ error } = await supabase.from('dashboard_tasks').update(payload).eq('id', r.id))
    } else {
      const res = await supabase.from('dashboard_tasks').insert(payload).select('id').single()
      error = res.error; savedId = res.data?.id
    }
    setSavingId(null)
    if (error) { toast.error(error.message); return }
    logAudit({ action: 'dashboard_task.save', entityType: 'dashboard_task', entityId: savedId, summary: payload.label })
    toast.success(t('saved'))
    load()
  }

  const deleteRow = async (idx) => {
    const r = rows[idx]
    if (!r.id) { setRows(rs => rs.filter((_, i) => i !== idx)); return }
    if (!window.confirm(t('saDashDeleteConfirm'))) return
    const { error } = await supabase.from('dashboard_tasks').delete().eq('id', r.id)
    if (error) { toast.error(error.message); return }
    logAudit({ action: 'dashboard_task.delete', entityType: 'dashboard_task', entityId: r.id, summary: r.label })
    toast.success(t('saved'))
    load()
  }

  const doTranslate = async () => {
    setTransBusy(true)
    try {
      const res = await translateLibraries()
      toast.success(t('saLibTranslatedN', { n: res?.translated ?? 0 }))
    } catch (e) {
      toast.error(e?.message || t('saLibTranslateErr'))
    } finally {
      setTransBusy(false)
    }
  }

  if (!isSuperAdmin()) return null

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>{t('saDashTitle')}</h1>
          <p className={styles.sub}>{t('saDashSub')}</p>
        </div>
        <button className={styles.transBtn} onClick={doTranslate} disabled={transBusy} title={t('saDashTranslateHint')}>
          🌐 {transBusy ? t('saLibTranslating') : t('saLibTranslate')}
        </button>
      </div>

      {loading ? (
        <div className={styles.loading}>{t('loading')}</div>
      ) : (
        <>
          <datalist id="dashTaskPaths">
            {paths.map(p => <option key={p.path} value={p.path}>{t(p.labelKey)}</option>)}
          </datalist>

          <div className={styles.list}>
            {rows.length === 0 && <div className={styles.empty}>{t('saDashEmpty')}</div>}
            {rows.map((r, idx) => (
              <div key={r.id ?? `new-${idx}`} className={`${styles.card} ${r.is_active ? '' : styles.cardOff}`}>
                <div className={styles.grid}>
                  <label className={styles.field} style={{ width: 86 }}>
                    <span className={styles.lbl}>{t('saDashOrder')}</span>
                    <input className={styles.input} type="number" value={r.sort_order}
                      onChange={e => setField(idx, 'sort_order', e.target.value)} />
                  </label>
                  <label className={styles.field} style={{ width: 80 }}>
                    <span className={styles.lbl}>{t('saDashIcon')}</span>
                    <select className={styles.input} value={r.icon} onChange={e => setField(idx, 'icon', e.target.value)}>
                      {(EMOJIS.includes(r.icon) ? EMOJIS : [r.icon, ...EMOJIS]).map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </label>
                  <label className={`${styles.field} ${styles.grow}`}>
                    <span className={styles.lbl}>{t('saDashLabel')}</span>
                    <input className={styles.input} value={r.label} placeholder={t('saDashLabelPh')}
                      onChange={e => setField(idx, 'label', e.target.value)} />
                  </label>
                  <label className={`${styles.field} ${styles.grow}`}>
                    <span className={styles.lbl}>{t('saDashPath')}</span>
                    <input className={styles.input} list="dashTaskPaths" value={r.path} placeholder="/admin/..."
                      onChange={e => setField(idx, 'path', e.target.value)} />
                  </label>
                </div>

                <div className={styles.grid}>
                  <label className={styles.field}>
                    <span className={styles.lbl}>{t('saDashVertical')}</span>
                    <select className={styles.input} value={r.vertical} onChange={e => setField(idx, 'vertical', e.target.value)}>
                      <option value="">{t('saDashAny')}</option>
                      {VERTICALS.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span className={styles.lbl}>{t('saDashPerm')}</span>
                    <select className={styles.input} value={r.perm} onChange={e => setField(idx, 'perm', e.target.value)}>
                      <option value="">{t('saDashAny')}</option>
                      {perms.map(p => <option key={p.key} value={p.key}>{p.moduleLabel} — {p.label}</option>)}
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span className={styles.lbl}>{t('saDashAddon')}</span>
                    <select className={styles.input} value={r.addon} onChange={e => setField(idx, 'addon', e.target.value)}>
                      <option value="">{t('saDashAny')}</option>
                      {addons.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      {r.addon && !addons.some(a => a.id === r.addon) && <option value={r.addon}>{r.addon}</option>}
                    </select>
                  </label>
                  <label className={`${styles.field} ${styles.checkField}`}>
                    <input type="checkbox" checked={r.is_active} onChange={e => setField(idx, 'is_active', e.target.checked)} />
                    <span>{t('saDashActive')}</span>
                  </label>
                </div>

                <div className={styles.actions}>
                  <button className={styles.saveBtn} onClick={() => saveRow(idx)} disabled={savingId === idx}>
                    {savingId === idx ? t('saving') : t('save')}
                  </button>
                  <button className={styles.delBtn} onClick={() => deleteRow(idx)}>{t('saDashDelete')}</button>
                </div>
              </div>
            ))}
          </div>

          <button className={styles.addBtn} onClick={addRow}>+ {t('saDashAddTask')}</button>
        </>
      )}
    </div>
  )
}
