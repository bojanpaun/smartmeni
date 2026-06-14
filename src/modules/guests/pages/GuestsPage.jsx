// src/modules/guests/pages/GuestsPage.jsx

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import { useMoney } from '../../../lib/useMoney'
import { useSortable } from '../../../hooks/useSortable'
import SortableHead from '../../../components/shared/SortableHead'
import styles from './GuestsPage.module.css'

// Status → i18n ključ (admin ns). VIP/Blacklist su univerzalni nazivi.
const STATUS_KEY = {
  regular: 'agpStRegular', vip: 'agpStVip', blacklist: 'agpStBlacklist', pending: 'agpStPending',
}
const STATUS_STYLES = {
  regular: { background: 'var(--c-bg-subtle)', color: 'var(--c-text-medium)' },
  vip: { background: 'var(--c-warning-bg)', color: 'var(--c-warning)' },
  blacklist: { background: 'var(--c-danger-bg)', color: 'var(--c-danger)' },
  pending: { background: 'var(--c-info-bg)', color: 'var(--c-info)' },
}

const EMPTY_FORM = {
  first_name: '', last_name: '', phone: '', email: '',
  date_of_birth: '', status: 'regular', notes: ''
}

export default function GuestsPage() {
  const { t, i18n } = useTranslation('admin')
  const money = useMoney()
  const dl = i18n.language === 'en' ? 'en-US' : 'sr-Latn'
  const { restaurant } = usePlatform()
  const navigate = useNavigate()
  const [guests, setGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (restaurant) loadGuests() }, [restaurant])

  const loadGuests = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('guests')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false })
    setGuests(data || [])
    setLoading(false)
  }

  const saveGuest = async (e) => {
    e.preventDefault(); setSaving(true)
    const payload = {
      ...form,
      date_of_birth: form.date_of_birth || null,
      restaurant_id: restaurant.id,
    }
    const { data } = await supabase.from('guests').insert(payload).select().single()
    if (data) setGuests(prev => [data, ...prev])
    setSaving(false); setShowForm(false); setForm(EMPTY_FORM)
  }

  const approveGuest = async (e, id) => {
    e.stopPropagation()
    const { data } = await supabase
      .from('guests').update({ status: 'regular', approved_at: new Date().toISOString() })
      .eq('id', id).eq('restaurant_id', restaurant.id).select().single()
    if (data) setGuests(prev => prev.map(g => g.id === id ? data : g))
  }

  const rejectGuest = async (e, id) => {
    e.stopPropagation()
    if (!confirm(t('agpRejectConfirm'))) return
    await supabase.from('guests').delete().eq('id', id).eq('restaurant_id', restaurant.id)
    setGuests(prev => prev.filter(g => g.id !== id))
  }

  const filtered = guests.filter(g => {
    if (filter !== 'all' && g.status !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return `${g.first_name} ${g.last_name}`.toLowerCase().includes(q) ||
        g.phone?.includes(q) || g.email?.toLowerCase().includes(q)
    }
    return true
  })

  const sort = useSortable('last_name', 'asc')
  const pendingCount = guests.filter(g => g.status === 'pending').length
  const initials = (g) => `${g.first_name?.[0] || ''}${g.last_name?.[0] || ''}`.toUpperCase()
  const fullName = (g) => `${g.first_name} ${g.last_name}`

  if (loading) return <div className={styles.loading}>{t('loading')}</div>

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.title}>{t('agpTitle')}</div>
        <div className={styles.topbarActions}>
          {pendingCount > 0 && (
            <button className={styles.btnPending} onClick={() => setFilter('pending')}>
              {t('agpPendingN', { n: pendingCount })}
            </button>
          )}
          <button className={styles.btnPrimary} onClick={() => setShowForm(true)}>
            + {t('agpAddGuest')}
          </button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder={t('agpSearchPh')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className={styles.filters}>
          {['all', 'regular', 'vip', 'blacklist', 'pending'].map(f => (
            <button
              key={f}
              className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? t('agpAll') : t(STATUS_KEY[f])}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>👥</div>
          <div className={styles.emptyTitle}>{t('agpEmptyTitle')}</div>
          <div className={styles.emptyDesc}>{t('agpEmptyDesc')}</div>
          <button className={styles.btnPrimary} onClick={() => setShowForm(true)}>+ {t('agpAddGuest')}</button>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th><SortableHead col="last_name"    label={t('agpColGuest')}     sortBy={sort.sortBy} sortDir={sort.sortDir} onSort={sort.onSort} /></th>
                <th><SortableHead col="status"       label={t('agpColStatus')}    sortBy={sort.sortBy} sortDir={sort.sortDir} onSort={sort.onSort} /></th>
                <th><SortableHead col="total_visits" label={t('agpColVisits')}    sortBy={sort.sortBy} sortDir={sort.sortDir} onSort={sort.onSort} /></th>
                <th><SortableHead col="total_spent"  label={t('agpColSpent')}     sortBy={sort.sortBy} sortDir={sort.sortDir} onSort={sort.onSort} /></th>
                <th><SortableHead col="updated_at"   label={t('agpColLastVisit')} sortBy={sort.sortBy} sortDir={sort.sortDir} onSort={sort.onSort} /></th>
                <th style={{ textAlign: 'right' }}>{t('agpColActions')}</th>
              </tr>
            </thead>
            <tbody>
              {sort.sort(filtered).map(g => (
                <tr key={g.id} className={styles.tableRow} onClick={() => navigate(`/admin/guests/${g.id}`)}>
                  <td>
                    <div className={styles.nameCell}>
                      {g.avatar_url
                        ? <img src={g.avatar_url} className={styles.avatar} alt={fullName(g)} />
                        : <div className={styles.avatar} style={{ background: 'var(--c-warning-bg)', color: 'var(--c-warning)' }}>{initials(g)}</div>
                      }
                      <div>
                        <div className={styles.guestName}>{fullName(g)}</div>
                        <div className={styles.guestSub}>{g.phone || g.email || '—'}</div>
                        <div className={styles.guestMobileInfo}>
                          <span className={styles.badge} style={STATUS_STYLES[g.status]}>{t(STATUS_KEY[g.status])}</span>
                          {g.total_visits > 0 && <span className={styles.mobileInfoItem}>{t('agpVisitsN', { n: g.total_visits })}</span>}
                          {g.total_spent > 0 && <span className={styles.mobileInfoItem}>{money(g.total_spent)}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={styles.badge} style={STATUS_STYLES[g.status]}>
                      {t(STATUS_KEY[g.status])}
                    </span>
                  </td>
                  <td className={styles.numCell}>{g.total_visits || 0}</td>
                  <td className={styles.spentCell}>
                    {g.total_spent > 0 ? money(g.total_spent) : '—'}
                  </td>
                  <td className={styles.dateCell}>
                    {g.updated_at ? new Date(g.updated_at).toLocaleDateString(dl) : '—'}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className={styles.rowActions}>
                      {g.status === 'pending' ? (<>
                        <button className={styles.btnApprove} onClick={e => approveGuest(e, g.id)}>{t('agpApprove')}</button>
                        <button className={styles.btnReject} onClick={e => rejectGuest(e, g.id)}>{t('agpReject')}</button>
                      </>) : (
                        <button className={styles.btnEdit} onClick={() => navigate(`/admin/guests/${g.id}`)}>{t('agpProfile')}</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className={styles.overlay} onClick={() => setShowForm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>{t('agpAddGuest')}</div>
              <button className={styles.modalClose} onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={saveGuest}>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>{t('agpFirstName')} *</label>
                  <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} required />
                </div>
                <div className={styles.field}>
                  <label>{t('agpLastName')} *</label>
                  <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} required />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>{t('agpPhone')}</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+382 67 ..." />
                </div>
                <div className={styles.field}>
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>{t('agpDob')}</label>
                  <input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label>{t('agpColStatus')}</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="regular">{t('agpStRegular')}</option>
                    <option value="vip">{t('agpStVip')}</option>
                    <option value="blacklist">{t('agpStBlacklist')}</option>
                  </select>
                </div>
              </div>
              <div className={styles.field}>
                <label>{t('agpNotes')}</label>
                <textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={t('agpNotesPh')} />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowForm(false)}>{t('cancel')}</button>
                <button type="submit" className={styles.btnPrimary} disabled={saving}>{saving ? t('saving') : t('agpAddGuest')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
