// ▶ Novi fajl: src/modules/guests/pages/GuestPortalPage.jsx
// Dostupno na: /:slug/profil

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { getTemplate } from '../../../lib/templates'
import styles from './GuestPortalPage.module.css'

const GUEST_SESSION_KEY = (slug) => `sm_guest_${slug}`

export default function GuestPortalPage() {
  const { slug } = useParams()
  const [restaurant, setRestaurant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('login') // login | profile
  const [guest, setGuest] = useState(null)
  const [reservations, setReservations] = useState([])
  const [orders, setOrders] = useState([])
  const [activeOrderId, setActiveOrderId] = useState(null)

  // Login forma
  const [loginPhone, setLoginPhone] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // Edit forma
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => { loadRestaurant() }, [slug])

  // Auto-login iz localStorage sesije + učitaj aktivnu narudžbu
  useEffect(() => {
    if (!slug) return
    try {
      const saved = localStorage.getItem(GUEST_SESSION_KEY(slug))
      const lastAct = localStorage.getItem(GUEST_SESSION_KEY(slug) + '_activity')
      if (!saved || !lastAct) return
      const elapsed = Date.now() - parseInt(lastAct, 10)
      if (elapsed >= 10 * 60 * 1000) {
        localStorage.removeItem(GUEST_SESSION_KEY(slug))
        localStorage.removeItem(GUEST_SESSION_KEY(slug) + '_activity')
        return
      }
      const session = JSON.parse(saved)
      if (session?.id) loadGuestById(session.id)
    } catch {}
    // Aktivna narudžba iz sessionStorage
    try {
      const orderId = sessionStorage.getItem(`sm_order_${slug}`)
      if (orderId) setActiveOrderId(orderId)
    } catch {}
  }, [slug])

  const loadGuestById = async (guestId) => {
    const { data } = await supabase
      .from('guests')
      .select('id, first_name, last_name, phone, email, date_of_birth, status, total_visits, total_spent, no_show_count, avatar_url')
      .eq('id', guestId)
      .single()
    if (!data || data.status === 'blacklist') return
    setGuest(data)
    setEditForm({ first_name: data.first_name, last_name: data.last_name, phone: data.phone || '', email: data.email || '', date_of_birth: data.date_of_birth || '' })
    loadReservations(data.id)
    loadOrders(data.id)
    setMode('profile')
  }

  const loadRestaurant = async () => {
    const { data } = await supabase
      .from('restaurants')
      .select('id, name, slug, logo_url, color, template')
      .eq('slug', slug)
      .single()
    setRestaurant(data)
    setLoading(false)
  }

  const findGuest = async (e) => {
    e.preventDefault()
    setLoginLoading(true); setLoginError('')
    const q = loginPhone.trim()
    const { data } = await supabase
      .from('guests')
      .select('id, first_name, last_name, phone, email, date_of_birth, status, total_visits, total_spent, no_show_count, avatar_url')
      .eq('restaurant_id', restaurant.id)
      .or(`phone.eq.${q},email.eq.${q}`)
      .single()

    setLoginLoading(false)

    if (!data) { setLoginError('Nismo pronašli vaše podatke. Provjerite telefon ili email.'); return }
    if (data.status === 'blacklist') { setLoginError('Pristup nije moguć.'); return }
    if (data.status === 'pending') { setLoginError('Vaš nalog čeka odobrenje restorana.'); return }

    setGuest(data)
    setEditForm({ first_name: data.first_name, last_name: data.last_name, phone: data.phone || '', email: data.email || '', date_of_birth: data.date_of_birth || '' })
    loadReservations(data.id)
    loadOrders(data.id)
    setMode('profile')
  }

  const loadReservations = async (guestId) => {
    const { data } = await supabase
      .from('reservations')
      .select('id, date, time, guests_count, table_number, status, note')
      .eq('guest_id', guestId)
      .order('date', { ascending: false })
      .limit(10)
    setReservations(data || [])
  }

  const loadOrders = async (guestId) => {
    const { data } = await supabase
      .from('orders')
      .select('id, status, total, table_number, created_at, order_items(name, quantity)')
      .eq('guest_id', guestId)
      .order('created_at', { ascending: false })
      .limit(20)
    setOrders(data || [])
  }

  const saveProfile = async (e) => {
    e.preventDefault(); setSaving(true); setSaveMsg('')
    const updates = {
      first_name: editForm.first_name,
      last_name: editForm.last_name,
      phone: editForm.phone || null,
      email: editForm.email || null,
      date_of_birth: editForm.date_of_birth || null,
    }
    const { data } = await supabase.from('guests').update(updates).eq('id', guest.id).select().single()
    if (data) { setGuest(data); setSaveMsg('Podaci sačuvani!') }
    setSaving(false); setEditMode(false)
    setTimeout(() => setSaveMsg(''), 3000)
  }

  if (loading) return <div className={styles.page}><div className={styles.loading}>Učitavanje...</div></div>
  if (!restaurant) return <div className={styles.page}><div className={styles.loading}>Restoran nije pronađen.</div></div>

  const tpl = getTemplate(restaurant?.template)
  const brand = tpl?.brand || restaurant?.color || '#0d7a52'
  const pageBg = tpl?.pageBg || '#f0f5f2'

  const STATUS_LABEL = { regular: 'Gost', vip: 'VIP gost', pending: 'Na čekanju' }
  const RES_STATUS = {
    pending: { label: 'Na čekanju', color: '#854F0B', bg: '#FAEEDA' },
    confirmed: { label: 'Potvrđena', color: '#085041', bg: '#E1F5EE' },
    cancelled: { label: 'Otkazana', color: '#5F5E5A', bg: '#F1EFE8' },
    completed: { label: 'Završena', color: '#085041', bg: '#E1F5EE' },
  }

  return (
    <div className={styles.page} style={{ background: pageBg }}>
      <div className={styles.card}>

        {/* Header */}
        <div className={styles.header} style={{ background: brand }}>
          <div className={styles.headerTop}>
            <a href={`/${slug}`} className={styles.backBtn}>← Meni</a>
          </div>
          <div className={styles.logoWrap}>
            {restaurant.logo_url
              ? <img src={restaurant.logo_url} alt={restaurant.name} className={styles.logoImg} />
              : <div className={styles.logoPlaceholder}>{restaurant.name[0]}</div>
            }
          </div>
          <div className={styles.restName}>{restaurant.name}</div>
          <div className={styles.subtitle}>{mode === 'login' ? 'Pristup profilu' : 'Moj profil'}</div>
        </div>

        {/* LOGIN */}
        {mode === 'login' && (
          <div className={styles.form}>
            <div className={styles.authTitle}>Pristup profilu</div>
            <div className={styles.authDesc}>Unesite vaš telefon ili email za pristup profilu.</div>
            <form onSubmit={findGuest}>
              <div className={styles.field}>
                <label>Telefon ili email *</label>
                <input
                  value={loginPhone}
                  onChange={e => setLoginPhone(e.target.value)}
                  placeholder="+382 67 ... ili vas@email.com"
                  required
                />
              </div>
              {loginError && <div className={styles.error}>{loginError}</div>}
              <button type="submit" className={styles.btnPrimary} style={{ background: brand }} disabled={loginLoading}>
                {loginLoading ? 'Provjera...' : 'Pristupi profilu →'}
              </button>
            </form>
            <div className={styles.registerPrompt}>
              Nemate profil?{' '}
              <a href={`/${slug}/registracija`} style={{ color: brand, fontWeight: 500 }}>Registruj se</a>
            </div>
            <a href={`/${slug}`} className={styles.backLink} style={{ color: brand }}>← Pogledajte meni</a>
          </div>
        )}

        {/* PROFIL */}
        {mode === 'profile' && guest && (
          <div className={styles.profileWrap}>

            {/* Info kartica */}
            <div className={styles.guestCard}>
              <div className={styles.guestAvatar} style={{ background: brand }}>
                {guest.avatar_url
                  ? <img src={guest.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} alt="" />
                  : `${guest.first_name[0]}${guest.last_name[0]}`
                }
              </div>
              <div className={styles.guestInfo}>
                <div className={styles.guestName}>{guest.first_name} {guest.last_name}</div>
                <div className={styles.guestSub}>{guest.phone || guest.email}</div>
                {guest.status === 'vip' && (
                  <span className={styles.vipBadge}>VIP</span>
                )}
              </div>
              <button className={styles.btnLogout} onClick={() => {
                try {
                  localStorage.removeItem(GUEST_SESSION_KEY(slug))
                  localStorage.removeItem(GUEST_SESSION_KEY(slug) + '_activity')
                } catch {}
                setMode('login'); setGuest(null); setLoginPhone('')
              }}>
                Odjava
              </button>
            </div>

            {/* Statistike */}
            <div className={styles.statsRow}>
              <div className={styles.statBox}>
                <div className={styles.statVal}>{guest.total_visits || 0}</div>
                <div className={styles.statLbl}>Posjeta</div>
              </div>
              <div className={styles.statBox}>
                <div className={styles.statVal} style={{ color: brand }}>€{parseFloat(guest.total_spent || 0).toFixed(0)}</div>
                <div className={styles.statLbl}>Potrošeno</div>
              </div>
              <div className={styles.statBox}>
                <div className={styles.statVal}>{guest.no_show_count || 0}</div>
                <div className={styles.statLbl}>Otkazano</div>
              </div>
            </div>

            {/* Edit podaci */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>Moji podaci</div>
                {!editMode && <button className={styles.btnEdit} onClick={() => setEditMode(true)}>Uredi</button>}
              </div>
              {saveMsg && <div className={styles.saveMsg} style={{ color: brand }}>✓ {saveMsg}</div>}

              {editMode ? (
                <form onSubmit={saveProfile}>
                  <div className={styles.fieldRow}>
                    <div className={styles.field}><label>Ime</label><input value={editForm.first_name} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} required /></div>
                    <div className={styles.field}><label>Prezime</label><input value={editForm.last_name} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} required /></div>
                  </div>
                  <div className={styles.field}><label>Telefon</label><input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="+382 67..." /></div>
                  <div className={styles.field}><label>Email</label><input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></div>
                  <div className={styles.field}><label>Datum rođenja</label><input type="date" value={editForm.date_of_birth} onChange={e => setEditForm(f => ({ ...f, date_of_birth: e.target.value }))} /></div>
                  <div className={styles.editActions}>
                    <button type="button" className={styles.btnCancel} onClick={() => setEditMode(false)}>Odustani</button>
                    <button type="submit" className={styles.btnPrimary} style={{ background: brand }} disabled={saving}>{saving ? 'Čuvanje...' : 'Sačuvaj'}</button>
                  </div>
                </form>
              ) : (
                <div className={styles.infoGrid}>
                  <div className={styles.infoRow}><span>Ime</span><span>{guest.first_name} {guest.last_name}</span></div>
                  <div className={styles.infoRow}><span>Telefon</span><span>{guest.phone || '—'}</span></div>
                  <div className={styles.infoRow}><span>Email</span><span>{guest.email || '—'}</span></div>
                  <div className={styles.infoRow}><span>Datum rođenja</span><span>{guest.date_of_birth ? new Date(guest.date_of_birth).toLocaleDateString('sr-Latn') : '—'}</span></div>
                </div>
              )}
            </div>

            {/* Moje narudžbe */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Moje narudžbe</div>

              {/* Aktivna narudžba iz sessionStorage — uvijek vidljiva */}
              {activeOrderId && (
                <button
                  className={styles.trackActiveBtn}
                  style={{ borderColor: brand, color: brand }}
                  onClick={() => { window.location.href = `/${slug}/narudzba/${activeOrderId}` }}
                >
                  📍 Prati aktivnu narudžbu uživo
                </button>
              )}

              {orders.length === 0 && !activeOrderId ? (
                <div className={styles.empty}>Nema evidentiranih narudžbi</div>
              ) : (
                <div className={styles.resList}>
                  {orders.map(ord => {
                    const isActive = !['served','closed'].includes(ord.status)
                    const statusLabel = {
                      received: 'Primljeno', preparing: 'U pripremi',
                      ready: 'Gotovo!', served: 'Servirano', closed: 'Zatvoreno'
                    }[ord.status] || ord.status
                    const statusColors = {
                      received:  { bg: '#e1f5ee', color: '#0d7a52' },
                      preparing: { bg: '#faeeda', color: '#ba7517' },
                      ready:     { bg: '#eeedfe', color: '#534ab7' },
                      served:    { bg: '#f1efe8', color: '#888780' },
                      closed:    { bg: '#f1efe8', color: '#888780' },
                    }[ord.status] || { bg: '#e1f5ee', color: '#0d7a52' }
                    return (
                      <div key={ord.id} className={styles.resItem}
                        style={{ cursor: isActive ? 'pointer' : 'default' }}
                        onClick={() => isActive && (window.location.href = `/${slug}/narudzba/${ord.id}`)}>
                        <div>
                          <div className={styles.resDate}>
                            {new Date(ord.created_at).toLocaleDateString('sr-Latn')} · {new Date(ord.created_at).toLocaleTimeString('sr-Latn', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className={styles.resInfo}>
                            {(ord.order_items || []).map(i => i.name).join(', ').slice(0, 45) || '—'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <span className={styles.resBadge} style={{ background: statusColors.bg, color: statusColors.color }}>{statusLabel}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: brand }}>€{parseFloat(ord.total || 0).toFixed(2)}</span>
                          {isActive && <span style={{ fontSize: 10, color: brand }}>👁 Prati</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Moje rezervacije */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Moje rezervacije</div>
              {reservations.length === 0 ? (
                <div className={styles.empty}>Nema evidentiranih rezervacija</div>
              ) : (
                <div className={styles.resList}>
                  {reservations.map(r => {
                    const st = RES_STATUS[r.status] || RES_STATUS.pending
                    return (
                      <div key={r.id} className={styles.resItem}>
                        <div className={styles.resDate}>{new Date(r.date).toLocaleDateString('sr-Latn')} · {r.time?.slice(0, 5)}</div>
                        <div className={styles.resInfo}>{r.guests_count} {r.guests_count === 1 ? 'gost' : 'gosta'}{r.table_number ? ` · Sto ${r.table_number}` : ''}</div>
                        <span className={styles.resBadge} style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
              <a href={`/${slug}/rezervacija`} className={styles.btnReserve} style={{ borderColor: brand, color: brand }}>
                + Nova rezervacija
              </a>
            </div>

            <a href={`/${slug}`} className={styles.backLink} style={{ color: brand }}>← Pogledajte meni</a>
          </div>
        )}
      </div>
    </div>
  )
}
