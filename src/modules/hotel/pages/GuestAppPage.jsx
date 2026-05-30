import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import LanguageSwitcher from '../../../i18n/LanguageSwitcher'
import styles from './GuestApp.module.css'

const SESSION_KEY = (slug) => `sm_guest_app_${slug}`

const CATEGORIES = [
  { id: 'housekeeping', label: 'Domaćinstvo',       labelEn: 'Housekeeping',     icon: '🧹' },
  { id: 'linen',        label: 'Posteljina/peškiri', labelEn: 'Linen & Towels',   icon: '🛏️' },
  { id: 'maintenance',  label: 'Kvar/Popravka',      labelEn: 'Maintenance',      icon: '🔧' },
  { id: 'food',         label: 'Hrana i piće',       labelEn: 'Food & Drinks',    icon: '🍽️' },
  { id: 'transport',    label: 'Prijevoz',            labelEn: 'Transport',        icon: '🚗' },
  { id: 'info',         label: 'Informacije',         labelEn: 'Information',      icon: 'ℹ️' },
  { id: 'other',        label: 'Ostalo',              labelEn: 'Other',            icon: '📋' },
]

const STATUS_CONFIG = {
  pending:     { label: 'Primljeno',    labelEn: 'Received',     color: '#e67e22' },
  in_progress: { label: 'U toku',       labelEn: 'In progress',  color: '#2563eb' },
  resolved:    { label: 'Riješeno',     labelEn: 'Resolved',     color: '#0d7a52' },
}

const FOLIO_ICONS = {
  room_charge: '🛏️', restaurant: '🍽️', minibar: '🍷', spa: '💆', other: '📋',
}

function fmt(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('sr-Latn', { day: 'numeric', month: 'short', year: 'numeric' })
}

function nightsBetween(ci, co) {
  if (!ci || !co) return 0
  return Math.max(0, Math.round((new Date(co) - new Date(ci)) / 86400000))
}

export default function GuestAppPage() {
  const { slug } = useParams()
  const [lang, setLang] = useState(() => localStorage.getItem('sm_lang') || 'me')
  const isEn = lang === 'en'

  const [restaurant, setRestaurant] = useState(null)
  const [loadingRest, setLoadingRest] = useState(true)

  // Auth state
  const [session, setSession] = useState(null)
  const [loginCode, setLoginCode] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // Active tab
  const [tab, setTab] = useState('stay')

  // Folio
  const [folio, setFolio] = useState(null)
  const [folioLoading, setFolioLoading] = useState(false)

  // Requests
  const [requests, setRequests] = useState([])
  const [reqLoading, setReqLoading] = useState(false)
  const [newReqCat, setNewReqCat] = useState('housekeeping')
  const [newReqMsg, setNewReqMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Load restaurant
  useEffect(() => {
    supabase.from('restaurants').select('id, name, slug, logo_url, phone, email, description')
      .eq('slug', slug).single()
      .then(({ data }) => { setRestaurant(data); setLoadingRest(false) })
  }, [slug])

  // Restore session
  useEffect(() => {
    if (!slug) return
    try {
      const saved = sessionStorage.getItem(SESSION_KEY(slug))
      if (saved) setSession(JSON.parse(saved))
    } catch {}
  }, [slug])

  // Load folio when tab changes
  useEffect(() => {
    if (tab === 'folio' && session && !folio) loadFolio()
  }, [tab, session])

  // Load requests when tab changes
  useEffect(() => {
    if (tab === 'requests' && session) loadRequests()
  }, [tab, session])

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!loginCode.trim() || !loginEmail.trim()) {
      return setLoginError(isEn ? 'Please fill in all fields' : 'Popunite sva polja')
    }
    setLoginLoading(true)
    setLoginError('')

    const { data, error } = await supabase.rpc('get_guest_reservation', {
      p_code: loginCode.trim(),
      p_email: loginEmail.trim(),
      p_restaurant_id: restaurant.id,
    })

    setLoginLoading(false)
    if (error || !data?.length) {
      return setLoginError(isEn
        ? 'Reservation not found. Check your code and email.'
        : 'Rezervacija nije pronađena. Provjerite kod i email.')
    }

    const res = data[0]
    sessionStorage.setItem(SESSION_KEY(slug), JSON.stringify(res))
    setSession(res)
  }

  const loadFolio = async () => {
    setFolioLoading(true)
    const { data } = await supabase.rpc('get_guest_folio', { p_reservation_id: session.id })
    setFolio(data ?? [])
    setFolioLoading(false)
  }

  const loadRequests = async () => {
    setReqLoading(true)
    const { data } = await supabase.rpc('get_guest_requests', { p_reservation_id: session.id })
    setRequests(data ?? [])
    setReqLoading(false)
  }

  const handleSubmitRequest = async (e) => {
    e.preventDefault()
    if (!newReqMsg.trim()) return
    setSubmitting(true)

    await supabase.from('guest_requests').insert({
      reservation_id: session.id,
      restaurant_id: restaurant.id,
      category: newReqCat,
      message: newReqMsg.trim(),
    })

    setNewReqMsg('')
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 3000)
    setSubmitting(false)
    loadRequests()
  }

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY(slug))
    setSession(null)
    setFolio(null)
    setRequests([])
  }

  if (loadingRest) {
    return <div className={styles.loading}><div className={styles.spinner} /></div>
  }

  if (!restaurant) {
    return (
      <div className={styles.notFound}>
        <div className={styles.notFoundIcon}>🏨</div>
        <h2>{isEn ? 'Hotel not found' : 'Hotel nije pronađen'}</h2>
      </div>
    )
  }

  // ── LOGIN SCREEN ─────────────────────────────────────────────
  if (!session) {
    return (
      <div className={styles.page}>
        <div className={styles.loginHeader}>
          <div className={styles.loginHeaderTop}>
            {restaurant.logo_url && <img src={restaurant.logo_url} alt={restaurant.name} className={styles.loginLogo} />}
            <div className={styles.loginHotelName}>{restaurant.name}</div>
            <button className={styles.langBtn} onClick={() => {
              const next = lang === 'me' ? 'en' : 'me'
              setLang(next)
              localStorage.setItem('sm_lang', next)
            }}>
              🌐 {lang === 'me' ? 'ENG' : 'MNE'}
            </button>
          </div>
          <p className={styles.loginSub}>
            {isEn ? 'Guest App — Online Services' : 'Guest App — Online usluge'}
          </p>
        </div>

        <div className={styles.loginCard}>
          <h2 className={styles.loginTitle}>
            {isEn ? 'Access your reservation' : 'Pristupite svojoj rezervaciji'}
          </h2>
          <p className={styles.loginHint}>
            {isEn
              ? 'Enter the 8-character code from your confirmation email and your email address.'
              : 'Unesite 8-slovni kod iz e-maila potvrde i vašu email adresu.'}
          </p>
          <form onSubmit={handleLogin} className={styles.loginForm}>
            <div className={styles.field}>
              <label>{isEn ? 'Reservation code' : 'Kod rezervacije'}</label>
              <input
                value={loginCode}
                onChange={e => setLoginCode(e.target.value.toUpperCase())}
                placeholder="ABCD1234"
                maxLength={8}
                className={styles.codeInput}
                autoComplete="off"
                autoCapitalize="characters"
              />
            </div>
            <div className={styles.field}>
              <label>E-mail</label>
              <input
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="marko@email.com"
              />
            </div>
            {loginError && <p className={styles.loginError}>{loginError}</p>}
            <button className={styles.btnPrimary} type="submit" disabled={loginLoading}>
              {loginLoading
                ? (isEn ? 'Searching...' : 'Pretraga...')
                : (isEn ? 'Continue →' : 'Nastavi →')}
            </button>
          </form>
        </div>

        <div className={styles.loginFooter}>Powered by SmartMeni</div>
      </div>
    )
  }

  // ── APP SCREEN ───────────────────────────────────────────────
  const nights = nightsBetween(session.check_in_date, session.check_out_date)
  const isCheckedIn = session.status === 'checked_in'

  const TABS = [
    { id: 'stay',     icon: '🏠', label: isEn ? 'Stay'     : 'Boravak'  },
    { id: 'hotel',    icon: '🏨', label: isEn ? 'Hotel'    : 'Hotel'    },
    { id: 'requests', icon: '📋', label: isEn ? 'Requests' : 'Zahtjevi' },
    { id: 'folio',    icon: '🧾', label: isEn ? 'Folio'    : 'Folio'    },
  ]

  return (
    <div className={styles.page}>
      {/* App header */}
      <div className={styles.appHeader}>
        <div className={styles.appHeaderLeft}>
          {restaurant.logo_url && <img src={restaurant.logo_url} alt={restaurant.name} className={styles.appLogo} />}
          <div>
            <div className={styles.appHotelName}>{restaurant.name}</div>
            <div className={styles.appGuestName}>{session.guest_name}</div>
          </div>
        </div>
        <div className={styles.appHeaderRight}>
          <button className={styles.langBtn} onClick={() => {
            const next = lang === 'me' ? 'en' : 'me'
            setLang(next)
            localStorage.setItem('sm_lang', next)
          }}>
            🌐 {lang === 'me' ? 'ENG' : 'MNE'}
          </button>
          <button className={styles.logoutBtn} onClick={handleLogout} title={isEn ? 'Log out' : 'Odjava'}>✕</button>
        </div>
      </div>

      {/* Tab content */}
      <div className={styles.tabContent}>

        {/* ── TAB: BORAVAK ── */}
        {tab === 'stay' && (
          <div className={styles.stayTab}>
            <div className={`${styles.statusBadge} ${isCheckedIn ? styles.statusIn : styles.statusPending}`}>
              {isCheckedIn
                ? (isEn ? '✅ Checked in' : '✅ Check-in obavljen')
                : (isEn ? '⏳ Arriving soon' : '⏳ Dolazak uskoro')}
            </div>

            <div className={styles.stayCard}>
              <div className={styles.stayRoomType}>{session.room_type_name ?? '—'}</div>
              {session.room_number && (
                <div className={styles.stayRoomNum}>
                  {isEn ? 'Room' : 'Soba'} <span>{session.room_number}</span>
                </div>
              )}
              <div className={styles.stayDates}>
                <div className={styles.stayDate}>
                  <div className={styles.stayDateLabel}>{isEn ? 'Check-in' : 'Dolazak'}</div>
                  <div className={styles.stayDateVal}>{fmt(session.check_in_date)}</div>
                </div>
                <div className={styles.stayNights}>{nights}<br /><span>{isEn ? (nights === 1 ? 'night' : 'nights') : (nights === 1 ? 'noć' : 'noći')}</span></div>
                <div className={styles.stayDate}>
                  <div className={styles.stayDateLabel}>{isEn ? 'Check-out' : 'Odlazak'}</div>
                  <div className={styles.stayDateVal}>{fmt(session.check_out_date)}</div>
                </div>
              </div>
            </div>

            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoIcon}>👥</span>
                <div>
                  <div className={styles.infoLabel}>{isEn ? 'Guests' : 'Gosti'}</div>
                  <div className={styles.infoVal}>
                    {session.adults} {isEn ? 'adult(s)' : 'odrasli'}
                    {session.children > 0 && ` + ${session.children} ${isEn ? 'child(ren)' : 'djece'}`}
                  </div>
                </div>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoIcon}>💳</span>
                <div>
                  <div className={styles.infoLabel}>{isEn ? 'Total' : 'Ukupno'}</div>
                  <div className={styles.infoVal}>€{Number(session.total_amount || 0).toFixed(2)}</div>
                </div>
              </div>
              {session.special_requests && (
                <div className={styles.infoItem} style={{ gridColumn: '1 / -1' }}>
                  <span className={styles.infoIcon}>📝</span>
                  <div>
                    <div className={styles.infoLabel}>{isEn ? 'Special requests' : 'Posebni zahtjevi'}</div>
                    <div className={styles.infoVal}>{session.special_requests}</div>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.quickActions}>
              <button className={styles.quickBtn} onClick={() => setTab('requests')}>
                <span>📋</span>
                {isEn ? 'Send request' : 'Pošalji zahtjev'}
              </button>
              <button className={styles.quickBtn} onClick={() => setTab('folio')}>
                <span>🧾</span>
                {isEn ? 'View folio' : 'Pregled folija'}
              </button>
            </div>
          </div>
        )}

        {/* ── TAB: HOTEL INFO ── */}
        {tab === 'hotel' && (
          <div className={styles.hotelTab}>
            <h2 className={styles.tabTitle}>{restaurant.name}</h2>

            <div className={styles.hotelInfoList}>
              <div className={styles.hotelInfoItem}>
                <span className={styles.hotelInfoIcon}>🕐</span>
                <div>
                  <div className={styles.hotelInfoLabel}>{isEn ? 'Check-in / Check-out' : 'Check-in / Check-out'}</div>
                  <div className={styles.hotelInfoVal}>14:00 / 11:00</div>
                </div>
              </div>
              <div className={styles.hotelInfoItem}>
                <span className={styles.hotelInfoIcon}>📶</span>
                <div>
                  <div className={styles.hotelInfoLabel}>WiFi</div>
                  <div className={styles.hotelInfoVal}>{isEn ? 'Available in all areas' : 'Dostupan u svim prostorima'}</div>
                </div>
              </div>
              <div className={styles.hotelInfoItem}>
                <span className={styles.hotelInfoIcon}>🛎️</span>
                <div>
                  <div className={styles.hotelInfoLabel}>{isEn ? 'Reception' : 'Recepcija'}</div>
                  <div className={styles.hotelInfoVal}>24/7</div>
                </div>
              </div>
              {restaurant.phone && (
                <div className={styles.hotelInfoItem}>
                  <span className={styles.hotelInfoIcon}>📞</span>
                  <div>
                    <div className={styles.hotelInfoLabel}>{isEn ? 'Contact' : 'Kontakt'}</div>
                    <div className={styles.hotelInfoVal}>
                      <a href={`tel:${restaurant.phone}`} className={styles.hotelLink}>{restaurant.phone}</a>
                    </div>
                  </div>
                </div>
              )}
              {restaurant.email && (
                <div className={styles.hotelInfoItem}>
                  <span className={styles.hotelInfoIcon}>✉️</span>
                  <div>
                    <div className={styles.hotelInfoLabel}>E-mail</div>
                    <div className={styles.hotelInfoVal}>
                      <a href={`mailto:${restaurant.email}`} className={styles.hotelLink}>{restaurant.email}</a>
                    </div>
                  </div>
                </div>
              )}
              {restaurant.description && (
                <div className={styles.hotelInfoItem} style={{ alignItems: 'flex-start' }}>
                  <span className={styles.hotelInfoIcon}>ℹ️</span>
                  <div>
                    <div className={styles.hotelInfoLabel}>{isEn ? 'About' : 'O hotelu'}</div>
                    <div className={styles.hotelInfoVal}>{restaurant.description}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: ZAHTJEVI ── */}
        {tab === 'requests' && (
          <div className={styles.requestsTab}>
            <h2 className={styles.tabTitle}>{isEn ? 'Send a Request' : 'Pošaljite zahtjev'}</h2>

            <form onSubmit={handleSubmitRequest} className={styles.reqForm}>
              <div className={styles.catGrid}>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`${styles.catBtn} ${newReqCat === cat.id ? styles.catBtnActive : ''}`}
                    onClick={() => setNewReqCat(cat.id)}
                  >
                    <span>{cat.icon}</span>
                    <span>{isEn ? cat.labelEn : cat.label}</span>
                  </button>
                ))}
              </div>

              <textarea
                className={styles.reqTextarea}
                value={newReqMsg}
                onChange={e => setNewReqMsg(e.target.value)}
                placeholder={isEn ? 'Describe your request...' : 'Opišite vaš zahtjev...'}
                rows={4}
              />

              {submitted && (
                <div className={styles.reqSuccess}>
                  ✅ {isEn ? 'Request sent! Our staff will respond shortly.' : 'Zahtjev poslan! Osoblje će odgovoriti uskoro.'}
                </div>
              )}

              <button className={styles.btnPrimary} type="submit" disabled={submitting || !newReqMsg.trim()}>
                {submitting ? '...' : (isEn ? 'Send Request' : 'Pošalji zahtjev')}
              </button>
            </form>

            {reqLoading ? (
              <div className={styles.loading}><div className={styles.spinner} /></div>
            ) : requests.length > 0 && (
              <div className={styles.reqHistory}>
                <div className={styles.reqHistoryTitle}>{isEn ? 'Your requests' : 'Vaši zahtjevi'}</div>
                {requests.map(r => {
                  const cat = CATEGORIES.find(c => c.id === r.category)
                  const st = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending
                  return (
                    <div key={r.id} className={styles.reqItem}>
                      <div className={styles.reqItemTop}>
                        <span className={styles.reqItemCat}>{cat?.icon} {isEn ? cat?.labelEn : cat?.label}</span>
                        <span className={styles.reqItemStatus} style={{ color: st.color }}>
                          {isEn ? st.labelEn : st.label}
                        </span>
                      </div>
                      <div className={styles.reqItemMsg}>{r.message}</div>
                      <div className={styles.reqItemTime}>
                        {new Date(r.created_at).toLocaleTimeString('sr-Latn', { hour: '2-digit', minute: '2-digit' })}
                        {' · '}
                        {new Date(r.created_at).toLocaleDateString('sr-Latn', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: FOLIO ── */}
        {tab === 'folio' && (
          <div className={styles.folioTab}>
            <h2 className={styles.tabTitle}>{isEn ? 'Your Folio' : 'Vaš folio'}</h2>

            {folioLoading ? (
              <div className={styles.loading}><div className={styles.spinner} /></div>
            ) : !folio || folio.length === 0 ? (
              <div className={styles.emptyFolio}>
                <span>🧾</span>
                <p>{isEn ? 'No charges yet.' : 'Nema stavki na foliju.'}</p>
              </div>
            ) : (
              <>
                <div className={styles.folioList}>
                  {folio.filter(f => f.item_id).map(item => (
                    <div key={item.item_id} className={styles.folioItem}>
                      <span className={styles.folioIcon}>{FOLIO_ICONS[item.type] ?? '📋'}</span>
                      <div className={styles.folioDesc}>
                        <div className={styles.folioDescText}>{item.description}</div>
                        {item.quantity !== 1 && (
                          <div className={styles.folioQty}>{item.quantity} × €{Number(item.unit_price).toFixed(2)}</div>
                        )}
                      </div>
                      <div className={styles.folioAmt}>€{Number(item.total_price || 0).toFixed(2)}</div>
                    </div>
                  ))}
                </div>

                <div className={styles.folioTotal}>
                  <span>{isEn ? 'Total' : 'Ukupno'}</span>
                  <span>€{Number(folio[0]?.folio_total || 0).toFixed(2)}</span>
                </div>

                <p className={styles.folioNote}>
                  {isEn
                    ? 'For questions about your folio, please contact reception.'
                    : 'Za pitanja o foliju, obratite se recepciji.'}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom tab bar */}
      <nav className={styles.bottomNav}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.navBtn} ${tab === t.id ? styles.navBtnActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className={styles.navIcon}>{t.icon}</span>
            <span className={styles.navLabel}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
