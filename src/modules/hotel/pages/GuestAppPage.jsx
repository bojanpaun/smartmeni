import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { goToPaymentSession } from '../../../lib/payments'
import LanguageSwitcher from '../../../i18n/LanguageSwitcher'
import GuestSpaTab from './GuestSpaTab'
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
  const { t, i18n } = useTranslation('guestapp')
  const isEn = i18n.language === 'en'

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
  const [paymentProvider, setPaymentProvider] = useState(false)
  const [folioPayLoading, setFolioPayLoading] = useState(false)
  const [folioPaidSuccess, setFolioPaidSuccess] = useState(false)

  // Requests
  const [requests, setRequests] = useState([])
  const [reqLoading, setReqLoading] = useState(false)
  const [newReqCat, setNewReqCat] = useState('housekeeping')
  const [newReqMsg, setNewReqMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Load restaurant + provjeri payment provider
  useEffect(() => {
    supabase.from('restaurants').select('*')
      .ilike('slug', slug).single()
      .then(({ data, error }) => {
        if (error) console.error('Restaurant load error:', error.message)
        setRestaurant(data)
        setLoadingRest(false)
        if (data?.id) {
          supabase.rpc('has_active_payment_provider', { p_restaurant_id: data.id })
            .then(({ data: hasProvider }) => setPaymentProvider(!!hasProvider))
        }
      })
  }, [slug])

  // Restore session + detektuj povratak iz payment gateway-a
  useEffect(() => {
    if (!slug) return
    try {
      const saved = sessionStorage.getItem(SESSION_KEY(slug))
      if (saved) setSession(JSON.parse(saved))
    } catch {}

    const params = new URLSearchParams(window.location.search)
    if (params.get('folio_paid') === '1') {
      setFolioPaidSuccess(true)
      setTab('folio')
      window.history.replaceState({}, '', window.location.pathname)
    }
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
      return setLoginError(t('errFillFields'))
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
      return setLoginError(t('errNotFound'))
    }

    const res = data[0]
    const sessionData = { ...res, reservation_code: loginCode.trim(), guest_email: loginEmail.trim() }
    sessionStorage.setItem(SESSION_KEY(slug), JSON.stringify(sessionData))
    setSession(sessionData)
  }

  const loadFolio = async () => {
    setFolioLoading(true)
    const { data } = await supabase.rpc('get_guest_folio', { p_reservation_id: session.id })
    setFolio(data ?? [])
    setFolioLoading(false)
  }

  const handleFolioPayment = async () => {
    const folioTotal = Number(folio?.[0]?.folio_total || 0)
    const folioId    = folio?.[0]?.folio_id
    if (!folioId || folioTotal <= 0 || !restaurant?.id) return
    setFolioPayLoading(true)
    const idempotencyKey = `folio-${folioId}-${Date.now()}`
    const successUrl = `${window.location.origin}/${slug}/guest?folio_paid=1`
    const cancelUrl  = `${window.location.origin}/${slug}/guest`
    const { data, error } = await supabase.functions.invoke('payments-create-session', {
      body: {
        restaurantId:    restaurant.id,
        sourceType:      'folio',
        sourceId:        folioId,
        amountMinor:     Math.round(folioTotal * 100),
        currency:        'EUR',
        idempotencyKey,
        successUrl,
        cancelUrl,
        description:     isEn ? 'Folio settlement' : 'Folio plaćanje',
        metadata: { guest_name: session?.guest_name ?? '' },
      },
    })
    setFolioPayLoading(false)
    if (error || (!data?.redirectUrl && !data?.formPost)) {
      alert(t('paymentErrorAlert'))
      return
    }
    goToPaymentSession(data)
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
        <h2>{t('notFoundHotel')}</h2>
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
            <LanguageSwitcher variant="dark" />
          </div>
          <p className={styles.loginSub}>
            {t('loginSubtitle')}
          </p>
        </div>

        <div className={styles.loginCard}>
          <h2 className={styles.loginTitle}>
            {t('loginTitle')}
          </h2>
          <p className={styles.loginHint}>
            {t('loginHint')}
          </p>
          <form onSubmit={handleLogin} className={styles.loginForm}>
            <div className={styles.field}>
              <label>{t('reservationCode')}</label>
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
              {loginLoading ? t('searching') : `${t('continue')} →`}
            </button>
          </form>
        </div>

        <div className={styles.loginFooter}>Powered by RestByMe</div>
      </div>
    )
  }

  // ── APP SCREEN ───────────────────────────────────────────────
  const nights = nightsBetween(session.check_in_date, session.check_out_date)
  const isCheckedIn = session.status === 'checked_in'

  const TABS = [
    { id: 'stay',     icon: '🏠', label: t('tabStay')     },
    { id: 'hotel',    icon: '🏨', label: t('tabHotel')    },
    { id: 'spa',      icon: '💆', label: t('tabSpa')      },
    { id: 'requests', icon: '📋', label: t('tabRequests') },
    { id: 'folio',    icon: '🧾', label: t('tabFolio')    },
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
          <LanguageSwitcher />
          <button className={styles.logoutBtn} onClick={handleLogout} title={t('logout')}>✕</button>
        </div>
      </div>

      {/* Tab content */}
      <div className={styles.tabContent}>

        {/* ── TAB: BORAVAK ── */}
        {tab === 'stay' && (
          <div className={styles.stayTab}>
            <div className={`${styles.statusBadge} ${isCheckedIn ? styles.statusIn : styles.statusPending}`}>
              {isCheckedIn ? t('checkedIn') : t('arrivingSoon')}
            </div>

            <div className={styles.stayCard}>
              <div className={styles.stayRoomType}>{session.room_type_name ?? '—'}</div>
              {session.room_number && (
                <div className={styles.stayRoomNum}>
                  {t('room')} <span>{session.room_number}</span>
                </div>
              )}
              <div className={styles.stayDates}>
                <div className={styles.stayDate}>
                  <div className={styles.stayDateLabel}>{t('checkIn')}</div>
                  <div className={styles.stayDateVal}>{fmt(session.check_in_date)}</div>
                </div>
                <div className={styles.stayNights}>{nights}<br /><span>{nights === 1 ? t('nightOne') : t('nightOther')}</span></div>
                <div className={styles.stayDate}>
                  <div className={styles.stayDateLabel}>{t('checkOut')}</div>
                  <div className={styles.stayDateVal}>{fmt(session.check_out_date)}</div>
                </div>
              </div>
            </div>

            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoIcon}>👥</span>
                <div>
                  <div className={styles.infoLabel}>{t('guests')}</div>
                  <div className={styles.infoVal}>
                    {session.adults} {t('adults')}
                    {session.children > 0 && ` + ${session.children} ${t('children')}`}
                  </div>
                </div>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoIcon}>💳</span>
                <div>
                  <div className={styles.infoLabel}>{t('total')}</div>
                  <div className={styles.infoVal}>€{Number(session.total_amount || 0).toFixed(2)}</div>
                </div>
              </div>
              {session.special_requests && (
                <div className={styles.infoItem} style={{ gridColumn: '1 / -1' }}>
                  <span className={styles.infoIcon}>📝</span>
                  <div>
                    <div className={styles.infoLabel}>{t('specialRequests')}</div>
                    <div className={styles.infoVal}>{session.special_requests}</div>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.quickActions}>
              <button className={styles.quickBtn} onClick={() => setTab('requests')}>
                <span>📋</span>
                {t('quickSendRequest')}
              </button>
              <button className={styles.quickBtn} onClick={() => setTab('folio')}>
                <span>🧾</span>
                {t('viewFolio')}
              </button>
            </div>
          </div>
        )}

        {/* ── TAB: SPA ── */}
        {tab === 'spa' && (
          <div className={styles.requestsTab}>
            <GuestSpaTab
              restaurantId={restaurant.id}
              session={session}
            />
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
                  <div className={styles.hotelInfoLabel}>{t('hotelCheckInOut')}</div>
                  <div className={styles.hotelInfoVal}>14:00 / 11:00</div>
                </div>
              </div>
              <div className={styles.hotelInfoItem}>
                <span className={styles.hotelInfoIcon}>📶</span>
                <div>
                  <div className={styles.hotelInfoLabel}>WiFi</div>
                  <div className={styles.hotelInfoVal}>{t('wifiAvailable')}</div>
                </div>
              </div>
              <div className={styles.hotelInfoItem}>
                <span className={styles.hotelInfoIcon}>🛎️</span>
                <div>
                  <div className={styles.hotelInfoLabel}>{t('reception')}</div>
                  <div className={styles.hotelInfoVal}>24/7</div>
                </div>
              </div>
              {restaurant.phone && (
                <div className={styles.hotelInfoItem}>
                  <span className={styles.hotelInfoIcon}>📞</span>
                  <div>
                    <div className={styles.hotelInfoLabel}>{t('contact')}</div>
                    <div className={styles.hotelInfoVal}>
                      <a href={`tel:${restaurant.phone}`} className={styles.hotelLink}>{restaurant.phone}</a>
                    </div>
                  </div>
                </div>
              )}
              {restaurant.description && (
                <div className={styles.hotelInfoItem} style={{ alignItems: 'flex-start' }}>
                  <span className={styles.hotelInfoIcon}>ℹ️</span>
                  <div>
                    <div className={styles.hotelInfoLabel}>{t('about')}</div>
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
            <h2 className={styles.tabTitle}>{t('sendARequest')}</h2>

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
                placeholder={t('describeRequest')}
                rows={4}
              />

              {submitted && (
                <div className={styles.reqSuccess}>
                  ✅ {t('requestSentMsg')}
                </div>
              )}

              <button className={styles.btnPrimary} type="submit" disabled={submitting || !newReqMsg.trim()}>
                {submitting ? '...' : t('sendRequestBtn')}
              </button>
            </form>

            {reqLoading ? (
              <div className={styles.loading}><div className={styles.spinner} /></div>
            ) : requests.length > 0 && (
              <div className={styles.reqHistory}>
                <div className={styles.reqHistoryTitle}>{t('yourRequests')}</div>
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
            <h2 className={styles.tabTitle}>{t('yourFolio')}</h2>

            {folioLoading ? (
              <div className={styles.loading}><div className={styles.spinner} /></div>
            ) : !folio || folio.length === 0 ? (
              <div className={styles.emptyFolio}>
                <span>🧾</span>
                <p>{t('noCharges')}</p>
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
                  <span>{t('total')}</span>
                  <span>€{Number(folio[0]?.folio_total || 0).toFixed(2)}</span>
                </div>

                {folioPaidSuccess && (
                  <div className={styles.folioPaidBanner}>
                    ✅ {t('paymentReceived')}
                  </div>
                )}

                {!folioPaidSuccess && paymentProvider && folio[0]?.folio_status === 'open' && Number(folio[0]?.folio_total) > 0 && (
                  <button
                    className={styles.folioPayBtn}
                    onClick={handleFolioPayment}
                    disabled={folioPayLoading}
                  >
                    {folioPayLoading ? t('redirecting') : t('payOnline')}
                  </button>
                )}

                <p className={styles.folioNote}>
                  {t('folioNote')}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom tab bar */}
      <nav className={styles.bottomNav}>
        {TABS.map(tabItem => (
          <button
            key={tabItem.id}
            className={`${styles.navBtn} ${tab === tabItem.id ? styles.navBtnActive : ''}`}
            onClick={() => setTab(tabItem.id)}
          >
            <span className={styles.navIcon}>{tabItem.icon}</span>
            <span className={styles.navLabel}>{tabItem.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
