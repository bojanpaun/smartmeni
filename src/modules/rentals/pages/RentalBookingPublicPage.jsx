import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { formatMoney, toMinorUnits } from '../../../lib/currencies'
import { goToPaymentSession } from '../../../lib/payments'
import { useContentTranslations } from '../../../lib/useContentTranslations'
import LanguageSwitcher from '../../../i18n/LanguageSwitcher'
import styles from './RentalBookingPublic.module.css'

const RentalMap = lazy(() => import('../../../components/shared/RentalMap'))

// Javni booking rental sredstava (RENT-0b). Anon → SECURITY DEFINER RPC-ovi
// (get_available_rental_assets / rental_quote_public već u redu / create_rental_booking_public).
// Tok: pretraga (datumi+gosti) → izbor sredstva → podaci gosta → potvrda + depozit (30%).

const AMENITIES = {
  wifi:        { icon: '📶', me: 'Wi-Fi',        en: 'Wi-Fi' },
  klima:       { icon: '❄️', me: 'Klima',        en: 'AC' },
  kuhinja:     { icon: '🍳', me: 'Kuhinja',      en: 'Kitchen' },
  bazen:       { icon: '🏊', me: 'Bazen',        en: 'Pool' },
  parking:     { icon: '🅿️', me: 'Parking',      en: 'Parking' },
  pogled_more: { icon: '🌊', me: 'Pogled na more', en: 'Sea view' },
  roštilj:     { icon: '🔥', me: 'Roštilj',      en: 'BBQ' },
}

function addDays(base, n) {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export default function RentalBookingPublicPage() {
  const { slug } = useParams()
  const { t, i18n } = useTranslation('rentbooking')
  const isEn = i18n.language === 'en'
  const locale = isEn ? 'en-US' : 'sr-Latn'

  const [restaurant, setRestaurant] = useState(null)
  const [loadingRest, setLoadingRest] = useState(true)
  const [paymentProvider, setPaymentProvider] = useState(false)
  const tr = useContentTranslations(restaurant?.id)

  const today = new Date().toISOString().slice(0, 10)
  const [start, setStart] = useState(addDays(today, 1))
  const [end, setEnd] = useState(addDays(today, 4))
  const [guests, setGuests] = useState(2)

  const [step, setStep] = useState('search')     // search | results | guest | done
  const [assets, setAssets] = useState([])
  const [searched, setSearched] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [paid, setPaid] = useState(false)
  const [locFilter, setLocFilter] = useState('')   // filter po lokaciji (client-side)
  const [view, setView] = useState('list')          // lista | mapa

  const locLabel = (a) => [a.location_name, a.city].filter(Boolean).join(', ')
  const locations = useMemo(() => [...new Set(assets.map(locLabel).filter(Boolean))], [assets])
  const shownAssets = locFilter ? assets.filter(a => locLabel(a) === locFilter) : assets

  const cur = restaurant?.currency || 'EUR'

  useEffect(() => {
    supabase.from('restaurants').select('id, name, slug, logo_url, currency, active_verticals, color')
      .ilike('slug', slug).single()
      .then(({ data }) => {
        setRestaurant(data)
        setLoadingRest(false)
        if (data?.id) {
          supabase.rpc('has_active_payment_provider', { p_restaurant_id: data.id })
            .then(({ data: has }) => setPaymentProvider(!!has))
        }
      })
    if (new URLSearchParams(window.location.search).get('rent_paid') === '1') {
      setPaid(true); setStep('done')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [slug])

  const search = async () => {
    setError('')
    if (end <= start) { setError(t('errDates')); return }
    setLoading(true)
    const { data, error: e } = await supabase.rpc('get_available_rental_assets', {
      p_restaurant_id: restaurant.id, p_start: start, p_end: end, p_guests: guests,
    })
    setLoading(false)
    if (e) { setError(t('errSearch')); return }
    setAssets(data || [])
    setLocFilter('')
    setSearched(true)
    setStep('results')
  }

  // Izlog: čim se tenant učita, automatski pokaži ponudu (pretraga sa default datumima) —
  // posjetilac odmah vidi smještaj sa slikama, umjesto prazne forme.
  useEffect(() => {
    if (restaurant?.id && (restaurant.active_verticals || []).includes('rental') && step === 'search' && !paid && !searched) {
      search()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant])

  const pickAsset = (a) => { setSelected(a); setError(''); setStep('guest') }

  const confirm = async () => {
    setError('')
    if (!form.name.trim()) { setError(t('errName')); return }
    setLoading(true)
    const { data, error: e } = await supabase.rpc('create_rental_booking_public', {
      p_restaurant_id: restaurant.id, p_asset_id: selected.asset_id,
      p_start: start, p_end: end, p_adults: guests, p_children: 0,
      p_guest_name: form.name, p_guest_email: form.email, p_guest_phone: form.phone,
    })
    setLoading(false)
    if (e) {
      setError(e.code === '23P01' || /23P01/.test(e.message) ? t('errTaken') : (e.message || t('errBook')))
      return
    }
    setBooking(data)
    setStep('done')
    // Email potvrda (fire-and-forget) — samo ako je gost ostavio email.
    if (form.email?.trim()) {
      supabase.functions.invoke('send-rental-email', { body: { booking_id: data.booking_id } }).catch(() => {})
    }
  }

  const payDeposit = async () => {
    setLoading(true); setError('')
    const idempotencyKey = `rental:${booking.booking_id}:deposit`
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payments-create-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_KEY },
        body: JSON.stringify({
          restaurantId: restaurant.id, sourceType: 'rental', sourceId: booking.booking_id,
          amountMinor: toMinorUnits(booking.deposit, cur), currency: cur, idempotencyKey,
          successUrl: `${window.location.origin}/${slug}/rent?rent_paid=1`,
          cancelUrl:  `${window.location.origin}/${slug}/rent`,
          description: `${selected.name} — ${t('deposit')}`,
          metadata: { guest_name: form.name, guest_email: form.email },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('errPay'))
      goToPaymentSession(data)
    } catch (err) {
      setError(err.message || t('errPay')); setLoading(false)
    }
  }

  const nm = (a) => tr('rental_asset', a.asset_id, 'name', a.name)

  if (loadingRest) return <div className={styles.center}><div className={styles.spinner} /></div>
  if (!restaurant || !(restaurant.active_verticals || []).includes('rental')) {
    return <div className={styles.center}><div className={styles.notFound}>🏖️<p>{t('notFound')}</p></div></div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header} style={{ background: restaurant.color || '#0d7a52' }}>
        <div className={styles.headTop}>
          {restaurant.logo_url && <img src={restaurant.logo_url} alt={restaurant.name} className={styles.logo} />}
          <div className={styles.hotelName}>{restaurant.name}</div>
          <LanguageSwitcher variant="dark" />
        </div>
        <p className={styles.headSub}>{t('subtitle')}</p>
      </header>

      <div className={styles.body}>
        {/* Uspjeh nakon plaćanja / rezervacije */}
        {step === 'done' && (
          <div className={styles.card}>
            <div className={styles.doneIcon}>✅</div>
            <h2 className={styles.doneTitle}>{paid ? t('paidTitle') : t('doneTitle')}</h2>
            <p className={styles.doneSub}>{paid ? t('paidSub') : t('doneSub')}</p>
            {booking && !paid && (
              <div className={styles.summaryBox}>
                <div className={styles.sumRow}><span>{t('total')}</span><b>{formatMoney(booking.total_amount, cur, locale)}</b></div>
                <div className={styles.sumRow}><span>{t('deposit')} (30%)</span><b>{formatMoney(booking.deposit, cur, locale)}</b></div>
              </div>
            )}
            {booking && !paid && paymentProvider && booking.deposit > 0 && (
              <button className={styles.primaryBtn} onClick={payDeposit} disabled={loading}>
                {loading ? '…' : `💳 ${t('payDeposit')}`}
              </button>
            )}
            {error && <div className={styles.err}>{error}</div>}
          </div>
        )}

        {/* Pretraga */}
        {step === 'search' && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{t('searchTitle')}</h2>
            <div className={styles.fields}>
              <label className={styles.field}><span>{t('checkIn')}</span>
                <input type="date" value={start} min={today} onChange={e => setStart(e.target.value)} /></label>
              <label className={styles.field}><span>{t('checkOut')}</span>
                <input type="date" value={end} min={addDays(start, 1)} onChange={e => setEnd(e.target.value)} /></label>
              <label className={styles.field}><span>{t('guests')}</span>
                <input type="number" min={1} max={20} value={guests} onChange={e => setGuests(Math.max(1, +e.target.value || 1))} /></label>
            </div>
            {error && <div className={styles.err}>{error}</div>}
            <button className={styles.primaryBtn} onClick={search} disabled={loading}>
              {loading ? '…' : t('searchBtn')}
            </button>
          </div>
        )}

        {/* Rezultati */}
        {step === 'results' && (
          <>
            <button className={styles.backBtn} onClick={() => setStep('search')}>← {t('changeSearch')}</button>
            <div className={styles.datesLabel}>{start} → {end} · {guests} {t('guestsShort')}</div>
            {locations.length > 1 && (
              <div className={styles.locFilter}>
                <button className={`${styles.locChip} ${!locFilter ? styles.locChipOn : ''}`} onClick={() => setLocFilter('')}>{t('allLocations')}</button>
                {locations.map(l => (
                  <button key={l} className={`${styles.locChip} ${locFilter === l ? styles.locChipOn : ''}`} onClick={() => setLocFilter(l)}>📍 {l}</button>
                ))}
              </div>
            )}
            {shownAssets.some(a => a.latitude != null) && (
              <div className={styles.viewToggle}>
                <button className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnOn : ''}`} onClick={() => setView('list')}>☰ {t('viewList')}</button>
                <button className={`${styles.viewBtn} ${view === 'map' ? styles.viewBtnOn : ''}`} onClick={() => setView('map')}>🗺️ {t('viewMap')}</button>
              </div>
            )}
            {shownAssets.length === 0 && <div className={styles.empty}>{t('noneAvailable')}</div>}
            {view === 'map' && shownAssets.some(a => a.latitude != null) && (
              <Suspense fallback={<div className={styles.empty}>…</div>}>
                <RentalMap height={440}
                  markers={shownAssets.filter(a => a.latitude != null).map(a => ({ id: a.asset_id, lat: a.latitude, lng: a.longitude, label: nm(a), sublabel: formatMoney(a.total_amount, cur, locale) }))}
                  onSelect={(id) => { const a = shownAssets.find(x => x.asset_id === id); if (a) pickAsset(a) }} />
              </Suspense>
            )}
            {view === 'list' && (
            <div className={styles.assetList}>
              {shownAssets.map(a => (
                <div key={a.asset_id} className={styles.assetCard}>
                  <div className={styles.assetThumb}>
                    {(a.photos || []).length
                      ? <img src={a.photos[0]} alt={nm(a)} loading="lazy" decoding="async" onError={e => { e.currentTarget.style.display = 'none' }} />
                      : '🏠'}
                  </div>
                  <div className={styles.assetBody}>
                    <div className={styles.assetName}>{nm(a)}</div>
                    {(a.location_name || a.city) && <div className={styles.assetLoc}>📍 {[a.location_name, a.city].filter(Boolean).join(', ')}</div>}
                    <div className={styles.assetMeta}>
                      {a.max_guests ? <span>👥 {a.max_guests}</span> : null}
                      {a.bedrooms ? <span>🛏️ {a.bedrooms}</span> : null}
                      {a.bathrooms ? <span>🚿 {a.bathrooms}</span> : null}
                    </div>
                    {(a.amenities || []).length > 0 && (
                      <div className={styles.amenities}>
                        {(a.amenities || []).slice(0, 5).map(k => (
                          <span key={k} className={styles.amenity}>{AMENITIES[k]?.icon || '•'} {AMENITIES[k]?.[isEn ? 'en' : 'me'] || k}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={styles.assetRight}>
                    <div className={styles.assetTotal}>
                      <span className={styles.fromLabel}>{t('fromLabel')}</span> {formatMoney(a.base_price ?? (a.total_amount / a.nights), cur, locale)}<span className={styles.perNight}>{t('perNightShort')}</span>
                    </div>
                    <div className={styles.assetNights}>{a.nights} {a.nights === 1 ? t('night') : t('nights')} · {formatMoney(a.total_amount, cur, locale)}</div>
                    <button className={styles.primaryBtn} onClick={() => pickAsset(a)}>{t('reserve')}</button>
                  </div>
                </div>
              ))}
            </div>
            )}
          </>
        )}

        {/* Podaci gosta + rezime */}
        {step === 'guest' && selected && (
          <div className={styles.card}>
            <button className={styles.backBtn} onClick={() => setStep('results')}>← {t('back')}</button>
            <h2 className={styles.cardTitle}>{nm(selected)}</h2>
            <div className={styles.summaryBox}>
              <div className={styles.sumRow}><span>{start} → {end}</span><span>{selected.nights} {selected.nights === 1 ? t('night') : t('nights')}</span></div>
              <div className={styles.sumRow}><span>{t('accommodation')}</span><span>{formatMoney(selected.base_total, cur, locale)}</span></div>
              {selected.cleaning_fee > 0 && <div className={styles.sumRow}><span>{t('cleaning')}</span><span>{formatMoney(selected.cleaning_fee, cur, locale)}</span></div>}
              {selected.tourist_tax > 0 && <div className={styles.sumRow}><span>{t('touristTax')}</span><span>{formatMoney(selected.tourist_tax, cur, locale)}</span></div>}
              <div className={`${styles.sumRow} ${styles.sumTotal}`}><span>{t('total')}</span><b>{formatMoney(selected.total_amount, cur, locale)}</b></div>
            </div>
            <div className={styles.fields}>
              <label className={styles.field}><span>{t('name')} *</span>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></label>
              <label className={styles.field}><span>{t('email')}</span>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></label>
              <label className={styles.field}><span>{t('phone')}</span>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></label>
            </div>
            {error && <div className={styles.err}>{error}</div>}
            <button className={styles.primaryBtn} onClick={confirm} disabled={loading}>
              {loading ? '…' : t('confirmBtn')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
