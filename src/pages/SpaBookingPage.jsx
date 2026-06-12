import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { goToPaymentSession } from '../lib/payments'
import { useContentTranslations } from '../lib/useContentTranslations'
import LanguageSwitcher from '../i18n/LanguageSwitcher'
import styles from './SpaBookingPage.module.css'

// ── Helpers ──────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10)

function addDays(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function fmtDate(dateStr, locale = 'sr-Latn') {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

const CATEGORY_ICON = { massage: '💆', facial: '✨', body: '🧖', nail: '💅', wellness: '🌿', group: '👥' }
// Kategorija → i18n ključ (spa namespace). Prevod naziva tretmana (svc.name) je
// tenant-sadržaj → Faza 3 (AI); ovdje se prevode samo fiksne kategorije.
const CATEGORY_KEY = { massage: 'catMassage', facial: 'catFacial', body: 'catBody', nail: 'catNail', wellness: 'catWellness', group: 'catGroup' }

// ── Main Component ────────────────────────────────────────────

export default function SpaBookingPage() {
  const { slug } = useParams()
  const { t, i18n } = useTranslation('spa')
  const isEn = i18n.language === 'en'
  const dateLoc = isEn ? 'en-US' : 'sr-Latn'
  const catLabel = (cat) => t(CATEGORY_KEY[cat] ?? '', { defaultValue: cat })

  const [restaurant, setRestaurant] = useState(null)
  const [loadingRest, setLoadingRest] = useState(true)
  const tr = useContentTranslations(restaurant?.id) // AI prevodi naziva/opisa usluge

  // Prevedeni naziv/opis usluge za aktivni jezik (fallback na izvor).
  const svcName = (s) => s ? tr('spa_service', s.id, 'name', s.name) : ''
  const svcDesc = (s) => s ? tr('spa_service', s.id, 'description', s.description) : ''

  const [step, setStep] = useState(0)

  // Step 0 — treatments
  const [services, setServices] = useState([])
  const [catFilter, setCatFilter] = useState('all')
  const [selectedService, setSelectedService] = useState(null)

  // Step 1 — date + therapist
  const [date, setDate] = useState(addDays(TODAY, 1))
  const [therapistPref, setTherapistPref] = useState('any') // 'any' | therapist_id

  // Step 2 — slots
  const [slots, setSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)

  // Step 3 — guest info
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestNotes, setGuestNotes] = useState('')

  // Step 4 — payment
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [reservationCode, setReservationCode] = useState('')
  const [booking, setBooking] = useState(false)
  const [bookError, setBookError] = useState('')

  // Confirmation
  const [confirmation, setConfirmation] = useState(null)

  // Load restaurant + services
  useEffect(() => {
    async function load() {
      const { data: rest } = await supabase
        .from('restaurants')
        .select('id, name, logo_url, slug')
        .ilike('slug', slug)
        .single()
      if (!rest) { setLoadingRest(false); return }
      setRestaurant(rest)

      const { data: svcs } = await supabase
        .from('spa_services')
        .select('*')
        .eq('restaurant_id', rest.id)
        .eq('is_active', true)
        .order('display_order')
      setServices(svcs ?? [])
      setLoadingRest(false)
    }
    load()
  }, [slug])

  // Load therapists (for preference dropdown in step 1)
  const [therapists, setTherapists] = useState([])
  useEffect(() => {
    if (!restaurant || !selectedService) return
    supabase
      .from('spa_therapists')
      .select('id, staff!staff_id(first_name, last_name), spa_therapist_services!inner(service_id)')
      .eq('restaurant_id', restaurant.id)
      .eq('is_available', true)
      .eq('spa_therapist_services.service_id', selectedService.id)
      .then(({ data }) => setTherapists(data ?? []))
  }, [restaurant, selectedService])

  // Load slots when date or therapist preference changes (step 2)
  useEffect(() => {
    if (step !== 2 || !restaurant || !selectedService) return
    setSlotsLoading(true)
    setSlots([])
    setSelectedSlot(null)
    supabase.rpc('get_available_spa_slots', {
      p_restaurant_id: restaurant.id,
      p_service_id:    selectedService.id,
      p_date:          date,
      p_therapist_id:  therapistPref === 'any' ? null : therapistPref,
    }).then(({ data }) => {
      // Deduplicate by start_time — group slots, prefer showing unique times
      const seen = new Set()
      const unique = (data ?? []).filter(s => {
        if (seen.has(s.slot_start)) return false
        seen.add(s.slot_start)
        return true
      })
      setSlots(unique)
      setSlotsLoading(false)
    })
  }, [step, restaurant, selectedService, date, therapistPref])

  const handleSelectService = (svc) => { setSelectedService(svc); setStep(1) }

  const handleDateNext = () => { setStep(2) }

  const handleSelectSlot = (slot) => { setSelectedSlot(slot); setStep(3) }

  const handleGuestNext = () => {
    if (!guestName.trim() || !guestEmail.trim() || !guestEmail.includes('@')) return
    setStep(4)
  }

  const handleBook = async () => {
    setBookError('')
    setBooking(true)

    const { data, error } = await supabase.rpc('book_spa_appointment', {
      p_restaurant_id:    restaurant.id,
      p_service_id:       selectedService.id,
      p_therapist_id:     selectedSlot.therapist_id || null,
      p_spa_room_id:      selectedSlot.spa_room_id  || null,
      p_date:             date,
      p_start_time:       selectedSlot.slot_start,
      p_end_time:         selectedSlot.slot_end,
      p_duration_minutes: selectedService.duration_minutes,
      p_price:            selectedSlot.price,
      p_guest_name:       guestName,
      p_guest_email:      guestEmail,
      p_guest_phone:      guestPhone || null,
      p_guest_notes:      guestNotes || null,
      p_payment_method:   paymentMethod,
      p_reservation_code: paymentMethod === 'folio' ? reservationCode : null,
    })

    if (error || data?.error) {
      setBookError(data?.error || t('bookingError'))
      setBooking(false)
      return
    }

    // Kartica: termin je kreiran (payment_status 'pending') → otvori plaćanje
    // (Faza PAY). Webhook za sourceType 'spa' označi termin plaćenim po uspjehu.
    if (paymentMethod === 'card') {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payments-create-session`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_KEY },
            body: JSON.stringify({
              restaurantId: restaurant.id,
              sourceType:   'spa',
              sourceId:     data.appointment_id,
              amountMinor:  Math.round(Number(selectedSlot.price) * 100),
              currency:     'EUR',
              idempotencyKey: data.appointment_id,
              successUrl:   `${window.location.origin}/${slug}/spa?paid=1`,
              cancelUrl:    `${window.location.origin}/${slug}/spa?cancelled=1`,
              description:  `${data.service_name} — ${data.date}`,
              metadata:     { source_type: 'spa', guest_email: guestEmail },
            }),
          }
        )
        const sess = await res.json()
        if (!res.ok || (!sess.redirectUrl && !sess.formPost)) throw new Error(sess.error || t('paymentStartError'))
        goToPaymentSession(sess)
        return
      } catch (e) {
        setBookError(e.message || t('paymentStartError'))
        setBooking(false)
        return
      }
    }

    setConfirmation(data)

    // Send confirmation email
    try {
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-spa-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_KEY,
          },
          body: JSON.stringify({
            to:             guestEmail,
            spaName:        restaurant.name,
            logoUrl:        restaurant.logo_url,
            guestName,
            serviceName:    data.service_name,
            date:           data.date,
            startTime:      data.start_time,
            endTime:        data.end_time,
            therapistName:  selectedSlot.therapist_name || null,
            roomName:       selectedSlot.room_name       || null,
            price:          data.price,
            paymentMethod:  data.payment_method,
            appointmentId:  data.appointment_id,
            type:           'confirmed',
          }),
        }
      )
    } catch (_) { /* email failure is non-critical */ }

    setBooking(false)
    setStep(5)
  }

  // ── Render ─────────────────────────────────────────────────

  if (loadingRest) return (
    <div className={styles.loadWrap}><div className={styles.spinner} /></div>
  )

  if (!restaurant) return (
    <div className={styles.loadWrap}><p className={styles.notFound}>{t('notFound')}</p></div>
  )

  // Povratak sa online plaćanja (webhook je već označio termin plaćenim).
  const payParam = new URLSearchParams(window.location.search).get('paid')
  if (payParam === '1') return (
    <div className={styles.page}>
      <div className={styles.confirmWrap || ''} style={{ maxWidth: 440, margin: '40px auto', textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{t('paySuccessTitle')}</h1>
        <p style={{ color: 'var(--c-text-muted)', marginBottom: 20 }}>
          {t('paySuccessDesc')}
        </p>
        <a href={`/${slug}/spa`} style={{ color: 'var(--c-primary, #0d7a52)', fontWeight: 600 }}>{t('backToBooking')}</a>
      </div>
    </div>
  )

  const cats = [...new Set(services.map(s => s.category))]
  const filtered = catFilter === 'all' ? services : services.filter(s => s.category === catFilter)

  const minDate = addDays(TODAY, 1)

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {restaurant.logo_url && (
            <img src={restaurant.logo_url} alt={restaurant.name} className={styles.logo} />
          )}
          <div>
            <h1 className={styles.hotelName}>{restaurant.name}</h1>
            <p className={styles.headerSub}>{t('headerSub')}</p>
          </div>
        </div>
        <LanguageSwitcher />
      </div>

      {/* Step indicator */}
      {step < 5 && (
        <div className={styles.steps}>
          {[t('stepTreatment'), t('stepDate'), t('stepTime'), t('stepDetails'), t('stepConfirm')].map((label, i) => (
            <div
              key={i}
              className={`${styles.step} ${i === step ? styles.stepActive : ''} ${i < step ? styles.stepDone : ''}`}
            >
              <div className={styles.stepDot}>{i < step ? '✓' : i + 1}</div>
              <span className={styles.stepLabel}>{label}</span>
            </div>
          ))}
        </div>
      )}

      <div className={styles.card}>

        {/* Step 0: Treatment selection */}
        {step === 0 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>{t('chooseTreatment')}</h2>
            {services.length === 0 ? (
              <div className={styles.empty}>{t('noServices')}</div>
            ) : (
              <>
                {/* Category filter */}
                <div className={styles.catFilter}>
                  <button className={`${styles.catBtn} ${catFilter === 'all' ? styles.catBtnActive : ''}`} onClick={() => setCatFilter('all')}>
                    {t('catAll')}
                  </button>
                  {cats.map(cat => (
                    <button key={cat} className={`${styles.catBtn} ${catFilter === cat ? styles.catBtnActive : ''}`} onClick={() => setCatFilter(cat)}>
                      {CATEGORY_ICON[cat]} {catLabel(cat)}
                    </button>
                  ))}
                </div>

                <div className={styles.serviceGrid}>
                  {filtered.map(svc => (
                    <div key={svc.id} className={styles.serviceCard} onClick={() => handleSelectService(svc)}>
                      {svc.image_url
                        ? <img src={svc.image_url} alt={svcName(svc)} className={styles.serviceImg} />
                        : <div className={styles.serviceImgPlaceholder}>{CATEGORY_ICON[svc.category]}</div>
                      }
                      <div className={styles.serviceBody}>
                        <div className={styles.serviceName}>{svcName(svc)}</div>
                        <div className={styles.serviceMeta}>
                          <span>⏱ {svc.duration_minutes} min</span>
                          {svc.price_couple && <span>👫 €{Number(svc.price_couple).toFixed(0)}/{t('perCouple')}</span>}
                        </div>
                        {svc.description && <p className={styles.serviceDesc}>{svcDesc(svc)}</p>}
                        <div className={styles.serviceFooter}>
                          <span className={styles.servicePrice}>€{Number(svc.price).toFixed(2)}</span>
                          <button className={styles.selectBtn}>{t('selectBtn')}</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 1: Date + therapist */}
        {step === 1 && selectedService && (
          <div className={styles.stepContent}>
            <button className={styles.btnBack} onClick={() => setStep(0)}>{t('changeTreatment')}</button>
            <h2 className={styles.stepTitle}>{t('chooseDate')}</h2>
            <div className={styles.summaryBox}>
              <strong>{CATEGORY_ICON[selectedService.category]} {svcName(selectedService)}</strong>
              <span className={styles.summaryMeta}>⏱ {selectedService.duration_minutes} min · €{Number(selectedService.price).toFixed(2)}</span>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>{t('treatmentDate')}</label>
              <input
                type="date"
                className={styles.fieldInput}
                value={date}
                min={minDate}
                onChange={e => setDate(e.target.value)}
              />
              <p className={styles.fieldHint}>{fmtDate(date, dateLoc)}</p>
            </div>
            {therapists.length > 0 && (
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>{t('preferredTherapist')}</label>
                <select className={styles.fieldInput} value={therapistPref} onChange={e => setTherapistPref(e.target.value)}>
                  <option value="any">{t('noPreference')}</option>
                  {therapists.map(th => (
                    <option key={th.id} value={th.id}>
                      {th.staff?.first_name} {th.staff?.last_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button className={styles.btnPrimary} onClick={handleDateNext}>{t('showSlots')}</button>
          </div>
        )}

        {/* Step 2: Slot selection */}
        {step === 2 && (
          <div className={styles.stepContent}>
            <button className={styles.btnBack} onClick={() => setStep(1)}>{t('changeDate')}</button>
            <h2 className={styles.stepTitle}>{t('chooseTime')}</h2>
            <p className={styles.stepSub}>{fmtDate(date, dateLoc)} · {selectedService?.name}</p>

            {slotsLoading ? (
              <div className={styles.slotsLoading}><div className={styles.spinner} /></div>
            ) : slots.length === 0 ? (
              <div className={styles.noSlots}>
                <div className={styles.noSlotsIcon}>😔</div>
                <p>{t('noSlots')}</p>
                <button className={styles.btnSecondary} onClick={() => setStep(1)}>{t('chooseOtherDate')}</button>
              </div>
            ) : (
              <div className={styles.slotsGrid}>
                {slots.map((slot, i) => (
                  <button
                    key={i}
                    className={`${styles.slotBtn} ${selectedSlot === slot ? styles.slotBtnActive : ''}`}
                    onClick={() => handleSelectSlot(slot)}
                  >
                    <div className={styles.slotTime}>{slot.slot_start?.slice(0,5)}</div>
                    {slot.therapist_name && (
                      <div className={styles.slotTherapist}>{slot.therapist_name}</div>
                    )}
                    <div className={styles.slotPrice}>€{Number(slot.price).toFixed(0)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Guest info */}
        {step === 3 && selectedSlot && (
          <div className={styles.stepContent}>
            <button className={styles.btnBack} onClick={() => setStep(2)}>{t('changeTime')}</button>
            <h2 className={styles.stepTitle}>{t('yourDetails')}</h2>
            <div className={styles.summaryBox}>
              <strong>{selectedService?.name}</strong>
              <span className={styles.summaryMeta}>
                {fmtDate(date, dateLoc)} · {selectedSlot.slot_start?.slice(0,5)}–{selectedSlot.slot_end?.slice(0,5)}
                {selectedSlot.therapist_name ? ` · ${selectedSlot.therapist_name}` : ''}
              </span>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>{t('nameLabel')}</label>
              <input className={styles.fieldInput} value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Marko Marković" />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>{t('emailLabel')}</label>
              <input type="email" className={styles.fieldInput} value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="marko@email.com" />
              <p className={styles.fieldHint}>{t('emailHint')}</p>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>{t('phoneLabel')}</label>
              <input type="tel" className={styles.fieldInput} value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="+387 61 000 000" />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>{t('notesLabel')}</label>
              <textarea className={styles.fieldTextarea} value={guestNotes} onChange={e => setGuestNotes(e.target.value)} rows={3} placeholder={t('notesPlaceholder')} />
            </div>
            <button
              className={styles.btnPrimary}
              onClick={handleGuestNext}
              disabled={!guestName.trim() || !guestEmail.trim() || !guestEmail.includes('@')}
            >
              {`${t('continue')} →`}
            </button>
          </div>
        )}

        {/* Step 4: Payment + confirmation */}
        {step === 4 && (
          <div className={styles.stepContent}>
            <button className={styles.btnBack} onClick={() => setStep(3)}>{t('back')}</button>
            <h2 className={styles.stepTitle}>{t('confirmReservation')}</h2>

            {/* Summary */}
            <div className={styles.summaryFull}>
              {[
                [t('sumTreatment'),  selectedService?.name],
                [t('sumDate'),       fmtDate(date, dateLoc)],
                [t('sumTime'),       `${selectedSlot?.slot_start?.slice(0,5)} – ${selectedSlot?.slot_end?.slice(0,5)}`],
                [t('sumTherapist'),  selectedSlot?.therapist_name || t('byAvailability')],
                [t('sumRoom'),       selectedSlot?.room_name || '—'],
                [t('sumGuest'),      guestName],
                [t('sumEmail'),      guestEmail],
              ].map(([k, v]) => (
                <div key={k} className={styles.summaryRow}>
                  <span className={styles.summaryKey}>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
              <div className={styles.summaryDivider} />
              <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                <span>{t('total')}</span>
                <span>€{Number(selectedSlot?.price || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Payment method */}
            <div className={styles.paymentSection}>
              <p className={styles.paymentLabel}>{t('paymentMethod')}</p>
              <div className={styles.paymentOptions}>
                <label className={`${styles.payOpt} ${paymentMethod === 'cash' ? styles.payOptActive : ''}`}>
                  <input type="radio" name="payment" value="cash" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} />
                  <span>{t('payCash')}</span>
                </label>
                <label className={`${styles.payOpt} ${paymentMethod === 'card' ? styles.payOptActive : ''}`}>
                  <input type="radio" name="payment" value="card" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} />
                  <span>{t('payCard')}</span>
                </label>
                <label className={`${styles.payOpt} ${paymentMethod === 'folio' ? styles.payOptActive : ''}`}>
                  <input type="radio" name="payment" value="folio" checked={paymentMethod === 'folio'} onChange={() => setPaymentMethod('folio')} />
                  <span>{t('payFolio')}</span>
                </label>
              </div>

              {paymentMethod === 'folio' && (
                <div className={styles.fieldGroup} style={{ marginTop: 12 }}>
                  <label className={styles.fieldLabel}>{t('folioCodeLabel')}</label>
                  <input
                    className={styles.fieldInput}
                    value={reservationCode}
                    onChange={e => setReservationCode(e.target.value)}
                    placeholder={t('folioCodePlaceholder')}
                  />
                  <p className={styles.fieldHint}>{t('folioCodeHint')}</p>
                </div>
              )}
            </div>

            {bookError && <p className={styles.error}>{bookError}</p>}
            <button
              className={styles.btnConfirm}
              onClick={handleBook}
              disabled={booking || (paymentMethod === 'folio' && !reservationCode.trim())}
            >
              {booking ? t('processing') : paymentMethod === 'card' ? t('continueToPay') : t('confirmBookingBtn')}
            </button>
          </div>
        )}

        {/* Step 5: Confirmation */}
        {step === 5 && confirmation && (
          <div className={styles.stepContent}>
            <div className={styles.confirmBlock}>
              <div className={styles.confirmIcon}>✅</div>
              <h2 className={styles.confirmTitle}>{t('bookedTitle')}</h2>
              <p className={styles.confirmSub}>
                {t('bookedSubPre')}<strong>{guestEmail}</strong>{t('bookedSubPost')}
              </p>
              <div className={styles.confirmDetails}>
                <div className={styles.confirmRow}>
                  <span>{t('apptNumber')}</span>
                  <span className={styles.confirmCode}>{confirmation.appointment_id?.slice(0,8).toUpperCase()}</span>
                </div>
                <div className={styles.confirmRow}>
                  <span>{t('sumTreatment')}</span>
                  <span>{confirmation.service_name}</span>
                </div>
                <div className={styles.confirmRow}>
                  <span>{t('dateTime')}</span>
                  <span>{fmtDate(date, dateLoc)} · {confirmation.start_time?.slice(0,5)}</span>
                </div>
                <div className={styles.confirmRow}>
                  <span>{t('total')}</span>
                  <span>€{Number(confirmation.price).toFixed(2)}</span>
                </div>
              </div>
              <button className={styles.btnSecondary} onClick={() => { setStep(0); setConfirmation(null); setSelectedService(null); setSelectedSlot(null) }}>
                {t('bookAnother')}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <span>Powered by <strong>RestByMe</strong></span>
      </div>
    </div>
  )
}
