// ▶ Zamijeniti: src/modules/tables/pages/OnlineReservationForm.jsx
// Dostupno na: /:slug/rezervacija

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { getTemplate } from '../../../lib/templates'
import styles from './OnlineReservationForm.module.css'

export default function OnlineReservationForm() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const realtimeChannelRef = useRef(null)
  const [restaurant, setRestaurant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [reservationId, setReservationId] = useState(null)
  const [reservationStatus, setReservationStatus] = useState('pending')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Auth stanje
  const [authMode, setAuthMode] = useState('check') // check | login | register_prompt | form
  const [guest, setGuest] = useState(null) // pronađeni gost iz registra
  const [phone, setPhone] = useState('')
  const [phoneSearching, setPhoneSearching] = useState(false)
  const [phoneError, setPhoneError] = useState('')

  const [form, setForm] = useState({
    date: '', time: '19:00', guests_count: 2, note: '', table_id: null, table_number: null,
    guest_name: '', guest_phone: '', guest_email: '',
  })
  const [tables, setTables] = useState([])
  const [reservedTables, setReservedTables] = useState([]) // zauzeti stolovi za odabrani termin
  const [conflictWarn, setConflictWarn] = useState(false)

  useEffect(() => { loadRestaurant() }, [slug])

  const loadRestaurant = async () => {
    const { data } = await supabase
      .from('restaurants')
      .select('id, name, slug, logo_url, color, template, online_reservations, reservation_visibility')
      .eq('slug', slug)
      .single()
    setRestaurant(data)
    if (data) {
      const { data: t } = await supabase.from('tables').select('id, number, capacity').eq('restaurant_id', data.id).order('number')
      setTables(t || [])
      // Ako je vidljivost 'all', preskoči identifikaciju
      const vis = data.reservation_visibility || (data.online_reservations ? 'all' : 'off')
      if (vis === 'all') setAuthMode('form_anonymous')
    }
    setLoading(false)
  }

  // Provjeri zauzete stolove za odabrani datum i vrijeme
  const checkConflicts = async (date, time) => {
    if (!date || !time || !restaurant) return
    const { data } = await supabase
      .from('reservations')
      .select('table_id')
      .eq('restaurant_id', restaurant.id)
      .eq('date', date)
      .eq('time', time)
      .in('status', ['pending', 'confirmed'])
    setReservedTables((data || []).map(r => r.table_id).filter(Boolean))
  }

  // Gost se identifikuje telefonom ili emailom
  // Za 'all' vidljivost — forma bez identifikacije
  const isAnonymous = authMode === 'form_anonymous'

  const findGuest = async (e) => {
    e.preventDefault()
    setPhoneSearching(true); setPhoneError('')
    const q = phone.trim()
    const { data } = await supabase
      .from('guests')
      .select('id, first_name, last_name, phone, email, status')
      .eq('restaurant_id', restaurant.id)
      .or(`phone.eq.${q},email.eq.${q}`)
      .single()

    setPhoneSearching(false)

    if (!data) {
      setPhoneError('Nismo pronašli vaše podatke u evidenciji. Molimo registrujte se prvo.')
      return
    }
    if (data.status === 'blacklist') {
      setPhoneError('Žao nam je, rezervacija nije moguća.')
      return
    }
    if (data.status === 'pending') {
      setPhoneError('Vaš nalog čeka odobrenje. Kontaktirajte restoran.')
      return
    }
    setGuest(data)
    setAuthMode('form')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isAnonymous && !form.guest_name.trim()) {
      setError('Unesite vaše ime.'); return
    }
    if (tables.length > 0 && !form.table_id) {
      setError('Molimo odaberite sto.'); return
    }
    // Provjeri konflikt još jednom prije slanja
    if (form.table_id && reservedTables.includes(form.table_id)) {
      setConflictWarn(true); setError('Odabrani sto je zauzet. Molimo odaberite drugi sto.'); return
    }
    setSaving(true); setError('')
    try {
      const { data: res } = await supabase.from('reservations').insert({
        restaurant_id: restaurant.id,
        guest_id: isAnonymous ? null : guest?.id,
        guest_name: isAnonymous ? form.guest_name : `${guest?.first_name} ${guest?.last_name}`,
        table_id: form.table_id || null,
        table_number: form.table_number || null,
        guest_phone: isAnonymous ? (form.guest_phone || null) : (guest?.phone || null),
        guest_email: isAnonymous ? (form.guest_email || null) : (guest?.email || null),
        date: form.date,
        time: form.time,
        guests_count: form.guests_count,
        note: form.note || null,
        status: 'pending',
        source: 'online',
      }).select().single()

      if (res?.id) {
        setReservationId(res.id)
        setReservationStatus('pending')
        // Realtime — prati promjenu statusa rezervacije
        const ch = supabase
          .channel(`reservation-${res.id}`)
          .on('postgres_changes', {
            event: 'UPDATE', schema: 'public', table: 'reservations',
            filter: `id=eq.${res.id}`,
          }, (payload) => {
            setReservationStatus(payload.new.status)
          })
          .subscribe()
        realtimeChannelRef.current = ch
      }
      setSubmitted(true)
    } catch {
      setError('Došlo je do greške. Pokušajte ponovo.')
    }
    setSaving(false)
  }

  if (loading) return <div className={styles.loadingWrap}>Učitavanje...</div>

  if (!restaurant) return (
    <div className={styles.errorWrap}>
      <div>🍽️</div><div>Restoran nije pronađen.</div>
    </div>
  )

  const tpl = getTemplate(restaurant?.template)
  const brand = tpl?.brand || restaurant?.color || '#0d7a52'
  const pageBg = tpl?.pageBg || '#f0f5f2'

  if (!restaurant.online_reservations) return (
    <div className={styles.pageWrap} style={{ background: pageBg }}>
      <div className={styles.card}>
        <div className={styles.header} style={{ background: brand }}>
          <div className={styles.headerTop}>
            <button className={styles.backBtn} onClick={() => navigate(`/${slug}`)}>← Meni</button>
          </div>
          <div className={styles.logoWrap}>
            {restaurant.logo_url
              ? <img src={restaurant.logo_url} alt={restaurant.name} className={styles.logoImg} />
              : <div className={styles.logoPlaceholder}>{restaurant.name[0]}</div>
            }
          </div>
          <div className={styles.restName}>{restaurant.name}</div>
        </div>
        <div className={styles.disabledMsg}>
          Online rezervacije trenutno nijesu dostupne.<br />Kontaktirajte restoran direktno.
        </div>
        <button className={styles.backLink} style={{ color: brand, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", padding: 0 }} onClick={() => navigate(`/${slug}`)}>← Pogledajte meni</button>
      </div>
    </div>
  )

  if (submitted) return (
    <div className={styles.pageWrap} style={{ background: pageBg }}>
      <div className={styles.card}>
        <div className={styles.header} style={{ background: brand }}>
          <div className={styles.headerTop}>
            <button className={styles.backBtn} onClick={() => navigate(`/${slug}`)}>← Meni</button>
          </div>
          <div className={styles.logoWrap}>
            {restaurant.logo_url
              ? <img src={restaurant.logo_url} alt={restaurant.name} className={styles.logoImg} />
              : <div className={styles.logoPlaceholder}>{restaurant.name[0]}</div>
            }
          </div>
          <div className={styles.restName}>{restaurant.name}</div>
        </div>
        <div className={styles.successWrap}>
          <div className={styles.successIcon}>✓</div>
          <div className={styles.successTitle}>Zahtjev poslan!</div>
          <div className={styles.successDesc}>
            Hvala{guest?.first_name ? `, ${guest.first_name}` : ''}! Vaš zahtjev za rezervaciju je primljen.
          </div>

          {/* Live status rezervacije */}
          <div className={styles.resStatusBlock}>
            {{
              pending:   { bg: '#faeeda', color: '#ba7517', icon: '⏳', label: 'Čeka potvrdu restorana' },
              confirmed: { bg: '#e1f5ee', color: '#0d7a52', icon: '✅', label: 'Rezervacija potvrđena!' },
              cancelled: { bg: '#fce8e8', color: '#a32d2d', icon: '✕',  label: 'Rezervacija otkazana' },
            }[reservationStatus] ? (
              <div className={styles.resStatusPill} style={{
                background: { pending:'#faeeda', confirmed:'#e1f5ee', cancelled:'#fce8e8' }[reservationStatus],
                color: { pending:'#ba7517', confirmed:'#0d7a52', cancelled:'#a32d2d' }[reservationStatus],
              }}>
                <span>{{ pending:'⏳', confirmed:'✅', cancelled:'✕' }[reservationStatus]}</span>
                <span>{{ pending:'Čeka potvrdu restorana', confirmed:'Rezervacija potvrđena!', cancelled:'Rezervacija otkazana' }[reservationStatus]}</span>
                {reservationStatus === 'pending' && <span className={styles.resPendingDot} />}
              </div>
            ) : null}
          </div>

          <div className={styles.successActions}>
            <button
              className={styles.btnSubmit}
              style={{ background: brand }}
              onClick={() => navigate(`/${slug}`)}
            >
              ← Nazad na meni
            </button>
            <button
              className={styles.btnSecondary}
              style={{ borderColor: brand, color: brand }}
              onClick={() => navigate(`/${slug}/profil`)}
            >
              👤 Moj profil
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  const minDate = new Date().toISOString().slice(0, 10)

  return (
    <div className={styles.pageWrap} style={{ background: pageBg }}>
      <div className={styles.card}>

        {/* Header */}
        <div className={styles.header} style={{ background: brand }}>
          <div className={styles.headerTop}>
            <button className={styles.backBtn} onClick={() => navigate(`/${slug}`)}>← Meni</button>
          </div>
          <div className={styles.logoWrap}>
            {restaurant.logo_url
              ? <img src={restaurant.logo_url} alt={restaurant.name} className={styles.logoImg} />
              : <div className={styles.logoPlaceholder}>{restaurant.name[0]}</div>
            }
          </div>
          <div className={styles.restName}>{restaurant.name}</div>
          <div className={styles.subtitle}>Online rezervacija</div>
        </div>

        {/* KORAK 1 — Identifikacija gosta */}
        {authMode === 'check' && (
          <div className={styles.form}>
            <div className={styles.authTitle}>Identifikacija</div>
            <div className={styles.authDesc}>
              Online rezervacije su dostupne samo registrovanim gostima.
              Unesite vaš telefon ili email da nastavite.
            </div>
            <form onSubmit={findGuest}>
              <div className={styles.field}>
                <label>Telefon ili email *</label>
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+382 67 ... ili vas@email.com"
                  required
                />
              </div>
              {phoneError && (
                <div className={styles.error}>
                  {phoneError}
                  {phoneError.includes('registrujte') && (
                    <a href={`/${slug}/registracija`} style={{ display: 'block', marginTop: 8, color: brand, fontWeight: 500 }}>
                      → Registruj se ovdje
                    </a>
                  )}
                </div>
              )}
              <button type="submit" className={styles.btnSubmit} style={{ background: brand }} disabled={phoneSearching}>
                {phoneSearching ? 'Provjera...' : 'Nastavi →'}
              </button>
            </form>
            <div className={styles.registerPrompt}>
              Niste registrovani?{' '}
              <a href={`/${slug}/registracija`} style={{ color: brand, fontWeight: 500 }}>
                Registruj se
              </a>
            </div>
            <button className={styles.menuLink} style={{ color: brand, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", padding: 0 }} onClick={() => navigate(`/${slug}`)}>← Pogledajte meni</button>
          </div>
        )}

        {/* KORAK 2 — Forma za rezervaciju */}
        {(authMode === 'form' && guest || authMode === 'form_anonymous') && (
          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Identitet gosta - anonymni unos */}
            {isAnonymous && (
              <div className={styles.anonFields}>
                <div className={styles.fieldRow}>
                  <div className={styles.field}><label>Ime i prezime *</label><input value={form.guest_name} onChange={e => setForm(f => ({...f, guest_name: e.target.value}))} placeholder="Nikola Petrović" required /></div>
                  <div className={styles.field}><label>Telefon</label><input value={form.guest_phone} onChange={e => setForm(f => ({...f, guest_phone: e.target.value}))} placeholder="+382 67..." /></div>
                </div>
              </div>
            )}

            {/* Identitet gosta - logovan */}
            {!isAnonymous && (
              <div className={styles.guestBadge}>
              <div className={styles.guestAvatar} style={{ background: brand }}>
                {guest?.first_name?.[0]}{guest?.last_name?.[0]}
              </div>
              <div>
                <div className={styles.guestName}>{guest?.first_name} {guest?.last_name}</div>
                <div className={styles.guestContact}>{guest.phone || guest.email}</div>
              </div>
              <button type="button" className={styles.btnChange} onClick={() => { setAuthMode('check'); setGuest(null) }}>
                Promijeni
              </button>
              </div>
            )}

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label>Datum *</label>
                <input type="date" min={minDate} value={form.date} onChange={e => { setForm(f => ({ ...f, date: e.target.value, table_id: null })); checkConflicts(e.target.value, form.time) }} required />
              </div>
              <div className={styles.field}>
                <label>Vrijeme *</label>
                <input type="time" value={form.time} onChange={e => { setForm(f => ({ ...f, time: e.target.value, table_id: null })); checkConflicts(form.date, e.target.value) }} required />
              </div>
            </div>

            <div className={styles.field}>
              <label>Broj gostiju *</label>
              <div className={styles.guestsControl}>
                <button type="button" onClick={() => setForm(f => ({ ...f, guests_count: Math.max(1, f.guests_count - 1) }))}>−</button>
                <span>{form.guests_count}</span>
                <button type="button" onClick={() => setForm(f => ({ ...f, guests_count: Math.min(20, f.guests_count + 1) }))}>+</button>
              </div>
            </div>

            {tables.length > 0 && (
              <div className={styles.field}>
                <label>Odaberi sto *</label>
                {conflictWarn && (
                  <div className={styles.conflictWarn}>
                    ⚠️ Odabrani sto je već rezervisan za ovo vrijeme.
                  </div>
                )}
                <div className={styles.tableGrid}>
                  {tables.map(t => {
                    const isReserved = reservedTables.includes(t.id)
                    const isSelected = form.table_id === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        disabled={isReserved}
                        className={`${styles.tableBtn} ${isSelected ? styles.tableBtnSelected : ''} ${isReserved ? styles.tableBtnReserved : ''}`}
                        style={isSelected ? { borderColor: brand, background: tpl?.catBg || '#e0f5ec', color: brand } : {}}
                        onClick={() => {
                          if (isReserved) return
                          setForm(f => ({ ...f, table_id: t.id, table_number: t.number }))
                          setConflictWarn(false)
                        }}
                      >
                        Sto {t.number}
                        {t.capacity && <div style={{ fontSize: 10, opacity: 0.7 }}>{t.capacity}×</div>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className={styles.field}>
              <label>Napomena</label>
              <textarea
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                rows={3}
                placeholder="Posebni zahtjevi, alergije, proslava..."
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.notice}>
              ℹ️ Ovo je zahtjev za rezervaciju. Restoran će vas kontaktirati radi potvrde.
            </div>

            <button type="submit" className={styles.btnSubmit} style={{ background: brand }} disabled={saving}>
              {saving ? 'Slanje...' : 'Pošalji zahtjev'}
            </button>

            <button className={styles.menuLink} style={{ color: brand, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", padding: 0 }} onClick={() => navigate(`/${slug}`)}>← Pogledajte meni</button>
          </form>
        )}
      </div>
    </div>
  )
}
