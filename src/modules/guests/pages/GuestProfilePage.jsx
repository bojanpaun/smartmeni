import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import { useMoney } from '../../../lib/useMoney'
import DateNav, { DATE_TODAY } from '../../../components/shared/DateNav'
import styles from './GuestProfilePage.module.css'

// Status → i18n ključ (admin ns) + boje (data).
const STATUS_KEY = { regular: 'agpStRegular', vip: 'agpStVip', blacklist: 'agpStBlacklist', pending: 'agpStPending' }
const STATUS_STYLES = {
  regular:   { background: '#f0f5f2', color: '#5a7a6a' },
  vip:       { background: '#FAEEDA', color: '#633806' },
  blacklist: { background: '#FCEBEB', color: '#791F1F' },
  pending:   { background: '#E6F1FB', color: '#0C447C' },
}
const VISIT_STATUS = {
  completed: { labelKey: 'gpfVsCompleted', bg: '#E1F5EE', color: '#085041' },
  cancelled: { labelKey: 'gpfVsCancelled', bg: '#f0f5f2', color: '#5a7a6a' },
  no_show:   { labelKey: 'gpfNoShow',      bg: '#FCEBEB', color: '#791F1F' },
  unpaid:    { labelKey: 'gpfVsUnpaid',    bg: '#FAEEDA', color: '#633806' },
}
const HOTEL_STATUS = {
  confirmed:   { labelKey: 'gpfHsConfirmed',  bg: '#E1F5EE', color: '#085041' },
  checked_in:  { labelKey: 'gpfHsCheckedIn',  bg: '#fff7ed', color: '#92400e' },
  checked_out: { labelKey: 'gpfHsCheckedOut', bg: '#f0f5f2', color: '#5a7a6a' },
  cancelled:   { labelKey: 'gpfHsCancelled',  bg: '#FCEBEB', color: '#791F1F' },
  no_show:     { labelKey: 'gpfNoShow',       bg: '#FCEBEB', color: '#791F1F' },
}
const SPA_STATUS = {
  confirmed:  { labelKey: 'gpfSsConfirmed',  bg: '#E1F5EE', color: '#085041' },
  checked_in: { labelKey: 'gpfSsCheckedIn',  bg: '#fff7ed', color: '#92400e' },
  completed:  { labelKey: 'gpfSsCompleted',  bg: '#f0f5f2', color: '#5a7a6a' },
  cancelled:  { labelKey: 'gpfSsCancelled',  bg: '#FCEBEB', color: '#791F1F' },
  no_show:    { labelKey: 'gpfNoShow',       bg: '#FCEBEB', color: '#791F1F' },
}

export default function GuestProfilePage() {
  const { t, i18n } = useTranslation('admin')
  const dl = i18n.language === 'en' ? 'en-US' : 'sr-Latn'
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString(dl, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  const money = useMoney()
  const { id } = useParams()
  const { restaurant } = usePlatform()
  const navigate = useNavigate()
  const fileRef = useRef()

  const [guest, setGuest] = useState(null)
  const [visits, setVisits] = useState([])
  const [orders, setOrders] = useState([])
  const [hotelStays, setHotelStays] = useState([])
  const [spaAppts, setSpaAppts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [filterFrom, setFilterFrom] = useState('2020-01-01')
  const [filterTo, setFilterTo] = useState(DATE_TODAY)
  const [search, setSearch] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [showVisitForm, setShowVisitForm] = useState(false)
  const [visitForm, setVisitForm] = useState({
    visit_date: new Date().toISOString().split('T')[0],
    table_number: '', party_size: 1, visit_type: 'walk_in',
    status: 'completed', amount_spent: '', notes: '',
  })

  useEffect(() => { if (restaurant) loadData() }, [restaurant, id])

  const loadData = async () => {
    setLoading(true)
    const [{ data: g }, { data: v }, { data: o }, { data: h }, { data: s }] = await Promise.all([
      supabase.from('guests').select('*').eq('id', id).eq('restaurant_id', restaurant.id).single(),
      supabase.from('guest_visits').select('*').eq('guest_id', id).order('visit_date', { ascending: false }),
      supabase.from('orders')
        .select('id, created_at, table_number, total, status, note, kitchen_status, bar_status')
        .eq('guest_id', id)
        .not('status', 'in', '(cancelled)')
        .order('created_at', { ascending: false }),
      supabase.from('hotel_reservations')
        .select('id, check_in_date, check_out_date, room_types(name), rate_per_night, total_amount, status, package_name, source')
        .eq('guest_id', id)
        .order('check_in_date', { ascending: false }),
      supabase.from('spa_appointments')
        .select('id, appointment_date, start_time, spa_services(name), spa_therapists(staff(first_name, last_name)), price, status')
        .eq('guest_id', id)
        .order('appointment_date', { ascending: false }),
    ])
    if (g) { setGuest(g); setForm(g) }
    setVisits(v || [])
    setOrders(o || [])
    setHotelStays(h || [])
    setSpaAppts(s || [])
    setLoading(false)
  }

  const saveGuest = async () => {
    setSaving(true)
    const updates = {
      first_name:      form.first_name,
      last_name:       form.last_name,
      phone:           form.phone           || null,
      email:           form.email           || null,
      date_of_birth:   form.date_of_birth   || null,
      nationality:     form.nationality     || null,
      document_number: form.document_number || null,
      status:          form.status,
      notes:           form.notes           || null,
      blacklist_reason: form.blacklist_reason || null,
    }
    const { data } = await supabase.from('guests').update(updates).eq('id', id).eq('restaurant_id', restaurant.id).select().single()
    if (data) setGuest(data)
    setSaving(false); setEditMode(false)
  }

  const uploadAvatar = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingAvatar(true)
    const ext = file.name.split('.').pop()
    const path = `${restaurant.id}/${id}.${ext}`
    await supabase.storage.from('guest-avatars').upload(path, file, { upsert: true })
    const { data: { publicUrl } } = supabase.storage.from('guest-avatars').getPublicUrl(path)
    const { data } = await supabase.from('guests').update({ avatar_url: publicUrl }).eq('id', id).eq('restaurant_id', restaurant.id).select().single()
    if (data) setGuest(data)
    setUploadingAvatar(false)
  }

  const removeAvatar = async () => {
    await supabase.from('guests').update({ avatar_url: null }).eq('id', id).eq('restaurant_id', restaurant.id)
    setGuest(g => ({ ...g, avatar_url: null }))
  }

  const saveVisit = async (e) => {
    e.preventDefault()
    const payload = {
      ...visitForm,
      guest_id: id,
      restaurant_id: restaurant.id,
      amount_spent: parseFloat(visitForm.amount_spent) || 0,
      party_size: parseInt(visitForm.party_size) || 1,
    }
    const { data } = await supabase.from('guest_visits').insert(payload).select().single()
    if (data) {
      setVisits(prev => [data, ...prev])
      const { data: g } = await supabase.from('guests').select('*').eq('id', id).eq('restaurant_id', restaurant.id).single()
      if (g) setGuest(g)
    }
    setShowVisitForm(false)
    setVisitForm({ visit_date: new Date().toISOString().split('T')[0], table_number: '', party_size: 1, visit_type: 'walk_in', status: 'completed', amount_spent: '', notes: '' })
  }

  const deleteVisit = async (visitId) => {
    if (!confirm(t('gpfDeleteVisitConfirm'))) return
    await supabase.from('guest_visits').delete().eq('id', visitId)
    setVisits(prev => prev.filter(v => v.id !== visitId))
    const { data: g } = await supabase.from('guests').select('*').eq('id', id).eq('restaurant_id', restaurant.id).single()
    if (g) setGuest(g)
  }

  if (loading) return <div className={styles.loading}>{t('loading')}</div>
  if (!guest) return <div className={styles.loading}>{t('gpfNotFound')}</div>

  // Tip posjete → prevod
  const visitTypeLabel = (vt) => vt === 'walk_in' ? t('gpfWalkIn') : vt === 'reservation' ? t('gpfReservation') : vt === 'online' ? t('gpfOnline') : vt
  // Status narudžbe → prevod
  const orderStatusLabel = (st) => st === 'closed' ? t('gpfOrdClosed') : st === 'served' ? t('gpfOrdServed') : st === 'pending' ? t('agpStPending') : st

  const initials = `${guest.first_name?.[0] || ''}${guest.last_name?.[0] || ''}`.toUpperCase()
  const hotelTotal  = hotelStays.reduce((s, h) => s + (Number(h.total_amount) || 0), 0)
  const ordersTotal = orders.reduce((s, o) => s + (Number(o.total) || 0), 0)

  const inRange = (dateStr) => {
    if (!dateStr) return true
    return dateStr >= filterFrom && dateStr <= filterTo
  }
  const matchSearch = (text) => !search || String(text ?? '').toLowerCase().includes(search.toLowerCase())

  const filteredVisits  = visits.filter(v =>
    inRange(v.visit_date) && matchSearch(`${v.table_number ?? ''} ${v.notes ?? ''} ${v.visit_type ?? ''}`)
  )
  const filteredOrders  = orders.filter(o =>
    inRange(o.created_at?.slice(0, 10)) && matchSearch(`${o.table_number ?? ''} ${o.note ?? ''}`)
  )
  const filteredHotel   = hotelStays.filter(h =>
    inRange(h.check_in_date) && matchSearch(`${h.room_types?.name ?? ''} ${h.package_name ?? ''}`)
  )
  const filteredSpa     = spaAppts.filter(a =>
    inRange(a.appointment_date) && matchSearch(`${a.spa_services?.name ?? ''} ${a.spa_therapists?.staff?.first_name ?? ''}`)
  )

  const allActivities = [
    ...filteredVisits.map(v => ({
      _key: `v-${v.id}`, _date: v.visit_date,
      _icon: '🍽️', _label: t('gpfActVisit'), _labelBg: '#E1F5EE', _labelColor: '#085041',
      _title: [v.table_number && `${t('gpfTable')} ${v.table_number}`, v.party_size && t('gpfPersonsN', { n: v.party_size }), visitTypeLabel(v.visit_type)].filter(Boolean).join(' · '),
      _amount: v.amount_spent > 0 ? Number(v.amount_spent) : null,
      _status: VISIT_STATUS[v.status] && t(VISIT_STATUS[v.status].labelKey), _stBg: VISIT_STATUS[v.status]?.bg, _stColor: VISIT_STATUS[v.status]?.color,
    })),
    ...filteredOrders.map(o => ({
      _key: `o-${o.id}`, _date: o.created_at?.slice(0, 10),
      _icon: '📋', _label: t('gpfActOrder'), _labelBg: '#d4f5e9', _labelColor: '#1a7a52',
      _title: [o.table_number && `${t('gpfTable')} ${o.table_number}`, o.note].filter(Boolean).join(' · ') || t('gpfRestaurant'),
      _amount: o.total ? Number(o.total) : null,
      _status: orderStatusLabel(o.status),
      _stBg: ['served','closed'].includes(o.status) ? '#E1F5EE' : '#fff7ed',
      _stColor: ['served','closed'].includes(o.status) ? '#085041' : '#92400e',
    })),
    ...filteredHotel.map(h => ({
      _key: `h-${h.id}`, _date: h.check_in_date,
      _icon: '🏨', _label: t('gpfActHotel'), _labelBg: '#dbeafe', _labelColor: '#1a4ea0',
      _title: [h.room_types?.name, h.package_name].filter(Boolean).join(' · ') || t('gpfHotelStay'),
      _amount: h.total_amount ? Number(h.total_amount) : null,
      _status: HOTEL_STATUS[h.status] && t(HOTEL_STATUS[h.status].labelKey), _stBg: HOTEL_STATUS[h.status]?.bg, _stColor: HOTEL_STATUS[h.status]?.color,
      _sub: `${fmtDate(h.check_in_date)} — ${fmtDate(h.check_out_date)}`,
    })),
    ...filteredSpa.map(a => ({
      _key: `s-${a.id}`, _date: a.appointment_date,
      _icon: '💆', _label: t('gpfActSpa'), _labelBg: '#f3e8ff', _labelColor: '#6b21a8',
      _title: [a.spa_services?.name, a.spa_therapists?.staff && `${a.spa_therapists.staff.first_name} ${a.spa_therapists.staff.last_name}`].filter(Boolean).join(' · '),
      _amount: a.price ? Number(a.price) : null,
      _status: SPA_STATUS[a.status] && t(SPA_STATUS[a.status].labelKey), _stBg: SPA_STATUS[a.status]?.bg, _stColor: SPA_STATUS[a.status]?.color,
    })),
  ].sort((a, b) => (b._date ?? '').localeCompare(a._date ?? ''))

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <button className={styles.backBtn} onClick={() => navigate('/admin/guests')}>← {t('agpTitle')}</button>
        <span>{guest.first_name} {guest.last_name}</span>
      </div>

      <div className={styles.profileCard}>
        {/* Header */}
        <div className={styles.profileHeader}>
          <div className={styles.avatarWrap}>
            {guest.avatar_url
              ? <img src={guest.avatar_url} className={styles.profileAvatar} alt={guest.first_name} />
              : <div className={styles.profileAvatar} style={{ background: '#FAEEDA', color: '#633806', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 600 }}>{initials}</div>
            }
            <div className={styles.avatarActions}>
              <button className={styles.btnAvatarChange} onClick={() => fileRef.current.click()} disabled={uploadingAvatar}>
                {uploadingAvatar ? '...' : '📷'}
              </button>
              {guest.avatar_url && <button className={styles.btnAvatarRemove} onClick={removeAvatar}>✕</button>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadAvatar} />
          </div>

          <div className={styles.profileInfo}>
            {editMode ? (
              <div className={styles.editInline}>
                <div className={styles.fieldRow}>
                  <input className={styles.editInput} value={form.first_name || ''} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder={t('agpFirstName')} />
                  <input className={styles.editInput} value={form.last_name || ''} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder={t('agpLastName')} />
                </div>
                <div className={styles.fieldRow}>
                  <input className={styles.editInput} value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder={t('agpPhone')} />
                  <input className={styles.editInput} value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" type="email" />
                </div>
                <div className={styles.fieldRow}>
                  <input className={styles.editInput} type="date" value={form.date_of_birth || ''} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} placeholder={t('agpDob')} />
                  <select className={styles.editInput} value={form.status || 'regular'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="regular">{t('agpStRegular')}</option>
                    <option value="vip">{t('agpStVip')}</option>
                    <option value="blacklist">{t('agpStBlacklist')}</option>
                  </select>
                </div>
                <div className={styles.fieldRow}>
                  <input className={styles.editInput} value={form.nationality || ''} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))} placeholder={t('gpfNationality')} />
                  <input className={styles.editInput} value={form.document_number || ''} onChange={e => setForm(f => ({ ...f, document_number: e.target.value }))} placeholder={t('gpfDocNumberPh')} />
                </div>
                {form.status === 'blacklist' && (
                  <input className={styles.editInput} value={form.blacklist_reason || ''} onChange={e => setForm(f => ({ ...f, blacklist_reason: e.target.value }))} placeholder={t('gpfBlacklistReasonPh')} />
                )}
              </div>
            ) : (
              <>
                <div className={styles.profileName}>{guest.first_name} {guest.last_name}</div>
                <div className={styles.profileSub}>
                  {guest.phone && <span>{guest.phone}</span>}
                  {guest.email && <span>{guest.email}</span>}
                  {guest.date_of_birth && <span>{fmtDate(guest.date_of_birth)}</span>}
                  {guest.nationality && <span>{guest.nationality}</span>}
                  {guest.document_number && <span>{t('gpfDocPrefix')} {guest.document_number}</span>}
                </div>
                <div className={styles.profileBadges}>
                  <span className={styles.badge} style={STATUS_STYLES[guest.status]}>{t(STATUS_KEY[guest.status])}</span>
                  {guest.user_id && <span className={styles.badge} style={{ background: '#E1F5EE', color: '#085041' }}>{t('gpfRegistered')}</span>}
                  {guest.blacklist_reason && <span className={styles.blacklistReason}>{guest.blacklist_reason}</span>}
                </div>
              </>
            )}
          </div>

          <div className={styles.headerActions}>
            {editMode ? (<>
              <button className={styles.btnPrimary} onClick={saveGuest} disabled={saving}>{saving ? t('saving') : t('gpfSave')}</button>
              <button className={styles.btnSecondary} onClick={() => { setEditMode(false); setForm(guest) }}>{t('cancel')}</button>
            </>) : (
              <button className={styles.btnSecondary} onClick={() => setEditMode(true)}>{t('gpfEdit')}</button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className={styles.statsRow}>
          <div className={styles.statBox}>
            <div className={styles.statVal}>{(guest.total_visits || 0) + orders.length}</div>
            <div className={styles.statLbl}>{t('gpfStRestVisits')}</div>
          </div>
          <div className={styles.statBox}>
            <div className={styles.statVal}>{hotelStays.length}</div>
            <div className={styles.statLbl}>{t('gpfStHotelStays')}</div>
          </div>
          <div className={styles.statBox}>
            <div className={styles.statVal}>{spaAppts.length}</div>
            <div className={styles.statLbl}>{t('gpfStSpa')}</div>
          </div>
          <div className={styles.statBox}>
            <div className={styles.statVal} style={{ color: '#0d7a52' }}>
              {money(parseFloat(guest.total_spent || 0) + hotelTotal + ordersTotal)}
            </div>
            <div className={styles.statLbl}>{t('gpfStTotalSpent')}</div>
          </div>
          <div className={styles.statBox}>
            <div className={styles.statVal} style={{ color: guest.no_show_count > 0 ? '#A32D2D' : 'inherit' }}>{guest.no_show_count || 0}</div>
            <div className={styles.statLbl}>{t('gpfStIncidents')}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabsWrap}>
          <div className={styles.tabs}>
            {[
              ['all',    `${t('gpfTabAll')} (${allActivities.length})`],
              ['visits', `${t('gpfTabRest')} (${filteredVisits.length + filteredOrders.length})`],
              ['hotel',  `${t('gpfTabHotel')} (${filteredHotel.length})`],
              ['spa',    `${t('gpfTabSpa')} (${filteredSpa.length})`],
              ['notes',  t('gpfTabNotes')],
              ['account', t('gpfTabAccount')],
            ].map(([key, label]) => (
              <button key={key} className={`${styles.tab} ${activeTab === key ? styles.tabActive : ''}`} onClick={() => setActiveTab(key)}>{label}</button>
            ))}
          </div>
        </div>

        {/* DateNav — prikazuje se za filterable tabove */}
        {!['notes','account'].includes(activeTab) && (
          <div className={styles.dateFilterSection}>
            <DateNav
              from={filterFrom}
              to={filterTo}
              search={search}
              onChange={(f, t2) => { setFilterFrom(f); setFilterTo(t2) }}
              onSearch={setSearch}
              showFuture={false}
              placeholder={t('gpfSearchPh')}
            />
          </div>
        )}

        {/* Sve aktivnosti */}
        {activeTab === 'all' && (
          <div className={styles.tabContent}>
            <div className={styles.tabHeader}>
              <div className={styles.tabTitle}>{t('gpfAllActivities')}</div>
            </div>
            {allActivities.length === 0 ? (
              <div className={styles.empty}>{t('gpfNoActivities')}</div>
            ) : (
              <div className={styles.visitList}>
                {allActivities.map(a => (
                  <div key={a._key} className={styles.visitItem}>
                    <div className={styles.visitDate}>
                      {fmtDate(a._date)}
                      {a._sub && <div style={{ fontSize: 10, color: '#8a9e96' }}>{a._sub}</div>}
                    </div>
                    <span className={styles.typeBadge} style={{ background: a._labelBg, color: a._labelColor }}>
                      {a._icon} {a._label}
                    </span>
                    <div className={styles.visitInfo}>{a._title}</div>
                    <span className={styles.visitBadge} style={{ background: a._stBg, color: a._stColor }}>
                      {a._status}
                    </span>
                    <div className={styles.visitAmount} style={{ color: '#0d7a52' }}>
                      {a._amount != null ? money(a._amount) : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Restoran */}
        {activeTab === 'visits' && (
          <div className={styles.tabContent}>
            <div className={styles.tabHeader}>
              <div className={styles.tabTitle}>{t('gpfVisitHistory')}</div>
              <button className={styles.btnPrimary} onClick={() => setShowVisitForm(v => !v)}>+ {t('gpfAddVisit')}</button>
            </div>

            {showVisitForm && (
              <form onSubmit={saveVisit} className={styles.inlineForm}>
                <div className={styles.fieldRow}>
                  <div className={styles.field}><label>{t('gpfVfDate')}</label><input type="date" value={visitForm.visit_date} onChange={e => setVisitForm(f => ({ ...f, visit_date: e.target.value }))} required /></div>
                  <div className={styles.field}><label>{t('gpfTable')}</label><input value={visitForm.table_number} onChange={e => setVisitForm(f => ({ ...f, table_number: e.target.value }))} placeholder={t('gpfTablePh')} /></div>
                  <div className={styles.field}><label>{t('gpfPersons')}</label><input type="number" min="1" value={visitForm.party_size} onChange={e => setVisitForm(f => ({ ...f, party_size: e.target.value }))} /></div>
                </div>
                <div className={styles.fieldRow}>
                  <div className={styles.field}><label>{t('gpfType')}</label>
                    <select value={visitForm.visit_type} onChange={e => setVisitForm(f => ({ ...f, visit_type: e.target.value }))}>
                      <option value="walk_in">{t('gpfWalkIn')}</option>
                      <option value="reservation">{t('gpfReservation')}</option>
                      <option value="online">{t('gpfOnline')}</option>
                    </select>
                  </div>
                  <div className={styles.field}><label>{t('agpColStatus')}</label>
                    <select value={visitForm.status} onChange={e => setVisitForm(f => ({ ...f, status: e.target.value }))}>
                      <option value="completed">{t('gpfVsCompleted')}</option>
                      <option value="cancelled">{t('gpfVsCancelled')}</option>
                      <option value="no_show">{t('gpfNoShow')}</option>
                      <option value="unpaid">{t('gpfVsUnpaid')}</option>
                    </select>
                  </div>
                  <div className={styles.field}><label>{t('gpfAmount')}</label><input type="number" min="0" step="0.01" value={visitForm.amount_spent} onChange={e => setVisitForm(f => ({ ...f, amount_spent: e.target.value }))} placeholder="0.00" /></div>
                </div>
                <div className={styles.field}><label>{t('agpNotes')}</label><input value={visitForm.notes} onChange={e => setVisitForm(f => ({ ...f, notes: e.target.value }))} placeholder={t('gpfOptional')} /></div>
                <div className={styles.saveRow}>
                  <button type="button" className={styles.btnSecondary} onClick={() => setShowVisitForm(false)}>{t('cancel')}</button>
                  <button type="submit" className={styles.btnPrimary}>{t('gpfSave')}</button>
                </div>
              </form>
            )}

            {/* Manualne posjete */}
            {filteredVisits.length === 0 && filteredOrders.length === 0 && visits.length === 0 ? (
              <div className={styles.empty}>{t('gpfNoVisits')}</div>
            ) : (
              <div className={styles.visitList}>
                {filteredVisits.map(v => (
                  <div key={v.id} className={styles.visitItem}>
                    <div className={styles.visitDate}>{fmtDate(v.visit_date)}</div>
                    <div className={styles.visitInfo}>
                      {v.table_number && `${t('gpfTable')} ${v.table_number} · `}{t('gpfPersonsN', { n: v.party_size })} · {visitTypeLabel(v.visit_type)}
                    </div>
                    <span className={styles.visitBadge} style={{ background: VISIT_STATUS[v.status]?.bg, color: VISIT_STATUS[v.status]?.color }}>
                      {VISIT_STATUS[v.status] && t(VISIT_STATUS[v.status].labelKey)}
                    </span>
                    <div className={styles.visitAmount} style={{ color: v.status === 'completed' ? '#0d7a52' : '#A32D2D' }}>
                      {v.amount_spent > 0 ? money(v.amount_spent) : '—'}
                    </div>
                    <button className={styles.delBtn} onClick={() => deleteVisit(v.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Narudžbe iz sistema */}
            <div className={styles.tabHeader} style={{ marginTop: 24 }}>
              <div className={styles.tabTitle}>{t('gpfOrdersInSystem')}</div>
            </div>
            {filteredOrders.length === 0 ? (
              <div className={styles.empty} style={{ padding: '12px 0' }}>
                {t('gpfNoOrders')}
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{t('gpfOrdersAutoLink')}</div>
              </div>
            ) : (
              <div className={styles.visitList}>
                {filteredOrders.map(o => {
                  const done = ['served', 'closed'].includes(o.status)
                  return (
                    <div key={o.id} className={styles.visitItem}>
                      <div className={styles.visitDate}>
                        {new Date(o.created_at).toLocaleDateString(dl, { day: '2-digit', month: 'short', year: 'numeric' })}
                        <span style={{ fontSize: 11, color: '#8a9e96', marginLeft: 6 }}>
                          {new Date(o.created_at).toLocaleTimeString(dl, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className={styles.visitInfo}>
                        {o.table_number ? `${t('gpfTable')} ${o.table_number}` : t('gpfRestaurant')}
                        {o.note && <span style={{ color: '#8a9e96', marginLeft: 6 }}>· {o.note}</span>}
                      </div>
                      <span className={styles.visitBadge} style={{
                        background: done ? '#E1F5EE' : '#fff7ed',
                        color: done ? '#085041' : '#92400e',
                      }}>
                        {orderStatusLabel(o.status)}
                      </span>
                      <div className={styles.visitAmount} style={{ color: '#0d7a52' }}>
                        {o.total ? money(o.total) : '—'}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Hotel boravci */}
        {activeTab === 'hotel' && (
          <div className={styles.tabContent}>
            <div className={styles.tabHeader}>
              <div className={styles.tabTitle}>{t('gpfHotelStays')}</div>
            </div>
            {filteredHotel.length === 0 ? (
              <div className={styles.empty}>{hotelStays.length === 0 ? t('gpfNoHotelStays') : t('gpfNoHotelPeriod')}</div>
            ) : (
              <div className={styles.visitList}>
                {filteredHotel.map(h => {
                  const st = HOTEL_STATUS[h.status] ?? HOTEL_STATUS.confirmed
                  const nights = h.check_in_date && h.check_out_date
                    ? Math.round((new Date(h.check_out_date) - new Date(h.check_in_date)) / 86400000)
                    : null
                  return (
                    <div key={h.id} className={styles.visitItem}>
                      <div className={styles.visitDate}>
                        {fmtDate(h.check_in_date)} — {fmtDate(h.check_out_date)}
                        {nights && <span style={{ fontSize: 11, color: '#8a9e96', marginLeft: 6 }}>{t('gpfNightsN', { n: nights })}</span>}
                      </div>
                      <div className={styles.visitInfo}>
                        {h.room_types?.name || '—'}
                        {h.package_name && <span style={{ color: '#0d7a52', marginLeft: 6 }}>· {h.package_name}</span>}
                      </div>
                      <span className={styles.visitBadge} style={{ background: st.bg, color: st.color }}>{t(st.labelKey)}</span>
                      <div className={styles.visitAmount} style={{ color: '#0d7a52' }}>
                        {h.total_amount ? money(h.total_amount) : '—'}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Spa tretmani */}
        {activeTab === 'spa' && (
          <div className={styles.tabContent}>
            <div className={styles.tabHeader}>
              <div className={styles.tabTitle}>{t('gpfSpaTreatments')}</div>
            </div>
            {filteredSpa.length === 0 ? (
              <div className={styles.empty}>{spaAppts.length === 0 ? t('gpfNoSpa') : t('gpfNoSpaPeriod')}</div>
            ) : (
              <div className={styles.visitList}>
                {filteredSpa.map(a => {
                  const st = SPA_STATUS[a.status] ?? SPA_STATUS.confirmed
                  const therapist = a.spa_therapists?.staff
                    ? `${a.spa_therapists.staff.first_name} ${a.spa_therapists.staff.last_name}`
                    : null
                  return (
                    <div key={a.id} className={styles.visitItem}>
                      <div className={styles.visitDate}>
                        {fmtDate(a.appointment_date)}
                        {a.start_time && <span style={{ fontSize: 11, color: '#8a9e96', marginLeft: 6 }}>{a.start_time.slice(0, 5)}</span>}
                      </div>
                      <div className={styles.visitInfo}>
                        {a.spa_services?.name || '—'}
                        {therapist && <span style={{ color: '#8a9e96', marginLeft: 6 }}>· {therapist}</span>}
                      </div>
                      <span className={styles.visitBadge} style={{ background: st.bg, color: st.color }}>{t(st.labelKey)}</span>
                      <div className={styles.visitAmount} style={{ color: '#0d7a52' }}>
                        {a.price ? money(a.price) : '—'}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Napomene */}
        {activeTab === 'notes' && (
          <div className={styles.tabContent}>
            <div className={styles.field}>
              <label>{t('gpfGuestNotes')}</label>
              <textarea
                rows={6}
                value={form.notes || ''}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder={t('gpfNotesPh')}
                className={styles.notesArea}
              />
            </div>
            <div className={styles.saveRow}>
              <button className={styles.btnPrimary} onClick={saveGuest} disabled={saving}>{saving ? t('saving') : t('gpfSaveNotes')}</button>
            </div>
          </div>
        )}

        {/* Nalog */}
        {activeTab === 'account' && (
          <div className={styles.tabContent}>
            {guest.user_id ? (
              <div className={styles.accountInfo}>
                <div className={styles.accountStatus}>
                  <span style={{ color: '#0d7a52', fontSize: 24 }}>✓</span>
                  <div>
                    <div className={styles.accountTitle}>{t('gpfHasAccount')}</div>
                    <div className={styles.accountSub}>{t('gpfHasAccountSub')}</div>
                    {guest.approved_at && <div className={styles.accountSub}>{t('gpfApproved')}: {fmtDate(guest.approved_at)}</div>}
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.accountInfo}>
                <div className={styles.accountStatus}>
                  <span style={{ color: '#8a9e96', fontSize: 24 }}>○</span>
                  <div>
                    <div className={styles.accountTitle}>{t('gpfNoAccount')}</div>
                    <div className={styles.accountSub}>{t('gpfNoAccountSub')}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
