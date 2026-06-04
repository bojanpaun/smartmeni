import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'
import { supabase } from '../lib/supabase'
import LanguageSwitcher from '../i18n/LanguageSwitcher'
import styles from './BookingPage.module.css'

function formatDate(d, lang) {
  if (!d) return ''
  const locale = lang === 'en' ? 'en-GB' : 'bs-BA'
  return new Date(d).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
}

function nightsBetween(ci, co) {
  if (!ci || !co) return 0
  return Math.max(0, (new Date(co) - new Date(ci)) / 86400000)
}

export default function BookingPage() {
  const { slug } = useParams()
  const { t, i18n } = useTranslation('booking')
  const lang = i18n.language

  const [restaurant, setRestaurant] = useState(null)
  const [loadingRest, setLoadingRest] = useState(true)
  const [step, setStep] = useState(0)

  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)

  const [rooms, setRooms] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [searchError, setSearchError] = useState('')

  const [expandedRoom, setExpandedRoom] = useState(null)
  const [packagesCache, setPackagesCache] = useState({})
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState(null)

  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [specialRequests, setSpecialRequests] = useState('')

  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState('')
  const [paymentProvider, setPaymentProvider] = useState(null) // null | true (ima aktivan provider)

  const [confirmation, setConfirmation] = useState(null)

  const nights = nightsBetween(checkIn, checkOut)
  const activePricePerNight = selectedPackage?.price_per_night ?? selectedRoom?.price_per_night ?? 0
  const totalAmount = activePricePerNight * nights

  useEffect(() => {
    supabase
      .from('restaurants')
      .select('id, name, slug, logo_url, booking_mode')
      .eq('slug', slug)
      .single()
      .then(({ data }) => {
        setRestaurant(data)
        setLoadingRest(false)
      })
  }, [slug])

  // Provjeri ima li hotel konfigurisan payment provider
  useEffect(() => {
    if (!restaurant?.id) return
    supabase.rpc('has_active_payment_provider', { p_restaurant_id: restaurant.id })
      .then(({ data }) => setPaymentProvider(!!data))
  }, [restaurant?.id])

  // Na return iz payment gateway-a — detektuj session_id (Stripe) ili token (legacy PayPal)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')  // Stripe redirect
    const token     = params.get('token')        // legacy PayPal redirect

    const stored = sessionStorage.getItem('booking_pending')
    if (!stored) return
    const pending = JSON.parse(stored)

    if (sessionId) {
      setStep(4)
      handleFinalize(sessionId, pending)
    } else if (token) {
      setStep(4)
      captureOrder(token, pending)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const searchRooms = async () => {
    if (!checkIn || !checkOut) return setSearchError(t('date.errNoDates'))
    if (nights <= 0) return setSearchError(t('date.errCheckOut'))
    setSearchError('')
    setSearchLoading(true)
    setRooms([])

    const { data, error } = await supabase.rpc('get_available_rooms', {
      p_restaurant_id: restaurant.id,
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_adults: adults,
    })

    setSearchLoading(false)
    if (error) return setSearchError(t('date.errSearch'))
    setRooms(data ?? [])
    setStep(1)
  }

  const handleSelectRoom = async (room) => {
    if (!room.has_packages) {
      setSelectedRoom(room)
      setSelectedPackage(null)
      setStep(2)
      return
    }
    if (expandedRoom === room.room_type_id) {
      setExpandedRoom(null)
      return
    }
    setExpandedRoom(room.room_type_id)
    setSelectedPackage(null)
    if (packagesCache[room.room_type_id]) return
    setPackagesLoading(true)
    const { data } = await supabase.rpc('get_room_packages', {
      p_room_type_id:  room.room_type_id,
      p_restaurant_id: restaurant.id,
      p_check_in:      checkIn,
      p_check_out:     checkOut,
    })
    setPackagesCache(prev => ({ ...prev, [room.room_type_id]: data ?? [] }))
    setPackagesLoading(false)
  }

  const handleConfirmPackage = (room) => {
    setSelectedRoom(room)
    setExpandedRoom(null)
    setStep(2)
  }

  const validateGuest = () => {
    if (!guestName.trim()) return t('guest.errName')
    if (!guestEmail.trim() || !guestEmail.includes('@')) return t('guest.errEmail')
    return null
  }

  const handleToPayment = () => {
    const err = validateGuest()
    if (err) return setPayError(err)
    setPayError('')
    setStep(3)
  }

  // Online plaćanje — Stripe ili Monri (zavisno od hotel konfiguracije)
  const handlePayOnline = async () => {
    setPayLoading(true)
    setPayError('')

    const idempotencyKey = `book-${restaurant.id}-${Date.now()}`
    const pending = {
      restaurant_id:    restaurant.id,
      room_type_id:     selectedRoom.room_type_id,
      rate_plan_id:     selectedPackage?.rate_plan_id ?? null,
      package_name:     selectedPackage?.plan_name ?? null,
      check_in:         checkIn,
      check_out:        checkOut,
      adults,
      children,
      guest_name:       guestName,
      guest_email:      guestEmail,
      guest_phone:      guestPhone,
      special_requests: specialRequests,
      price_per_night:  activePricePerNight,
      total_amount:     totalAmount,
      booking_mode:     restaurant?.booking_mode ?? 'immediate',
      idempotency_key:  idempotencyKey,
    }

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payments-create-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_KEY,
          },
          body: JSON.stringify({
            restaurantId:    restaurant.id,
            sourceType:      'booking',
            sourceId:        null,
            amountMinor:     Math.round(totalAmount * 100), // EUR → centi
            currency:        'EUR',
            idempotencyKey,
            successUrl:      `${window.location.origin}/${slug}/book`,
            cancelUrl:       `${window.location.origin}/${slug}/book?cancelled=1`,
            description:     `${selectedRoom.name} — ${nights} ${nights === 1 ? 'noć' : 'noći'}`,
            metadata: {
              guest_name:  guestName,
              guest_email: guestEmail,
            },
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('date.errSearch'))

      sessionStorage.setItem('booking_pending', JSON.stringify(pending))
      window.location.href = data.redirectUrl
    } catch (err) {
      setPayError(err.message)
      setPayLoading(false)
    }
  }

  // Finalizacija na povratku iz Stripe gateway-a
  const handleFinalize = async (sessionId, pending) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/booking-finalize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_KEY,
          },
          body: JSON.stringify({ session_id: sessionId, ...pending }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('date.errSearch'))
      setConfirmation(data)
      sessionStorage.removeItem('booking_pending')
    } catch (err) {
      setPayError(err.message)
    }
  }

  const handlePayOnArrival = async () => {
    setPayLoading(true)
    setPayError('')
    const bookingMode = restaurant?.booking_mode ?? 'immediate'
    const { data, error } = await supabase.rpc('create_booking_direct', {
      p_restaurant_id:    restaurant.id,
      p_room_type_id:     selectedRoom.room_type_id,
      p_rate_plan_id:     selectedPackage?.rate_plan_id ?? null,
      p_package_name:     selectedPackage?.plan_name ?? null,
      p_check_in:         checkIn,
      p_check_out:        checkOut,
      p_adults:           adults,
      p_children:         children,
      p_guest_name:       guestName,
      p_guest_email:      guestEmail,
      p_guest_phone:      guestPhone,
      p_special_requests: specialRequests,
      p_price_per_night:  activePricePerNight,
      p_total_amount:     totalAmount,
      p_status:           bookingMode === 'manual' ? 'inquiry' : 'confirmed',
    })
    setPayLoading(false)
    if (error) return setPayError(error.message ?? t('date.errSearch'))

    // Pošalji email gostu (fire-and-forget)
    const emailType = bookingMode === 'manual' ? 'received' : 'confirmed'
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-booking-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_KEY,
      },
      body: JSON.stringify({ reservation_id: data.reservation_id, type: emailType }),
    }).catch(() => {})

    setConfirmation({ ...data, booking_mode: bookingMode })
    setStep(4)
  }

  const captureOrder = async (orderId, pending) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/booking-order-capture`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_KEY,
          },
          body: JSON.stringify({
            paypal_order_id: orderId,
            booking_mode: restaurant?.booking_mode ?? 'immediate',
            ...pending,
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('date.errSearch'))
      setConfirmation(data)
      sessionStorage.removeItem('booking_pending')
    } catch (err) {
      setPayError(err.message)
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const minCheckOut = checkIn
    ? new Date(new Date(checkIn).getTime() + 86400000).toISOString().split('T')[0]
    : today

  const STEPS = [
    t('steps.dates'),
    t('steps.room'),
    t('steps.guest'),
    t('steps.payment'),
    t('steps.confirm'),
  ]

  if (loadingRest) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className={styles.notFound}>
        <div className={styles.notFoundIcon}>🏨</div>
        <h2>{t('hotelNotFound')}</h2>
        <p>{t('hotelNotFoundSub')}</p>
      </div>
    )
  }

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
            <p className={styles.headerSub}>{t('onlineBooking')}</p>
          </div>
        </div>
        <LanguageSwitcher />
      </div>

      {/* Step indicator */}
      {step < 4 && (
        <div className={styles.steps}>
          {STEPS.slice(0, 4).map((s, i) => (
            <div key={s} className={`${styles.step} ${i === step ? styles.stepActive : ''} ${i < step ? styles.stepDone : ''}`}>
              <div className={styles.stepDot}>{i < step ? '✓' : i + 1}</div>
              <span className={styles.stepLabel}>{s}</span>
            </div>
          ))}
        </div>
      )}

      <div className={styles.card}>
        {/* Step 0: Dates */}
        {step === 0 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>{t('date.title')}</h2>
            <div className={styles.dateGrid}>
              <div className={styles.field}>
                <label>{t('date.checkIn')}</label>
                <input
                  type="date"
                  min={today}
                  value={checkIn}
                  onChange={e => { setCheckIn(e.target.value); if (checkOut && e.target.value >= checkOut) setCheckOut('') }}
                />
              </div>
              <div className={styles.field}>
                <label>{t('date.checkOut')}</label>
                <input
                  type="date"
                  min={minCheckOut}
                  value={checkOut}
                  onChange={e => setCheckOut(e.target.value)}
                  disabled={!checkIn}
                />
              </div>
              <div className={styles.field}>
                <label>{t('date.adults')}</label>
                <select value={adults} onChange={e => setAdults(Number(e.target.value))}>
                  {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label>{t('date.children')}</label>
                <select value={children} onChange={e => setChildren(Number(e.target.value))}>
                  {[0,1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            {checkIn && checkOut && nights > 0 && (
              <p className={styles.nightsInfo}>
                {t('date.nights', { count: nights })} · {formatDate(checkIn, lang)} — {formatDate(checkOut, lang)}
              </p>
            )}
            {searchError && <p className={styles.error}>{searchError}</p>}
            <button className={styles.btnPrimary} onClick={searchRooms} disabled={searchLoading}>
              {searchLoading ? t('date.searching') : t('date.checkAvailability')}
            </button>
          </div>
        )}

        {/* Step 1: Room selection */}
        {step === 1 && (
          <div className={styles.stepContent}>
            <button className={styles.btnBack} onClick={() => setStep(0)}>{t('room.changeDates')}</button>
            <h2 className={styles.stepTitle}>{t('room.title')}</h2>
            <p className={styles.stepSub}>
              {t('room.summary', {
                nights,
                from: formatDate(checkIn, lang),
                to: formatDate(checkOut, lang),
                guests: adults + children,
              })}
            </p>

            {rooms.length === 0 ? (
              <div className={styles.noRooms}>
                <div className={styles.noRoomsIcon}>😔</div>
                <p>{t('room.noRooms')}</p>
                <button className={styles.btnSecondary} onClick={() => setStep(0)}>{t('room.changeSearch')}</button>
              </div>
            ) : (
              <div className={styles.roomList}>
                {rooms.map(room => {
                  const isExpanded = expandedRoom === room.room_type_id
                  const pkgs = packagesCache[room.room_type_id] ?? []
                  return (
                    <div key={room.room_type_id} className={`${styles.roomCard} ${isExpanded ? styles.roomCardExpanded : ''}`}>
                      {room.images?.length > 0 && (
                        <img src={room.images[0]} alt={room.name} className={styles.roomImg} />
                      )}
                      <div className={styles.roomBody}>
                        <div className={styles.roomName}>{room.name}</div>
                        {room.description && <p className={styles.roomDesc}>{room.description}</p>}
                        <div className={styles.roomMeta}>
                          <span>👥 {t('room.maxGuests', { count: room.max_occupancy })}</span>
                          {room.amenities?.slice(0, 4).map(a => (
                            <span key={a} className={styles.amenity}>{a}</span>
                          ))}
                          {(room.amenities?.length ?? 0) > 4 && (
                            <span className={styles.amenity}>+{room.amenities.length - 4}</span>
                          )}
                        </div>
                      </div>
                      <div className={styles.roomPrice}>
                        <div className={styles.roomPriceLabel}>{room.has_packages ? t('room.from') : ''}</div>
                        <div className={styles.roomPriceVal}>€{Number(room.price_per_night).toFixed(2)}</div>
                        <div className={styles.roomPriceSub}>{t('room.perNight')}</div>
                        <div className={styles.roomPriceTotal}>€{(room.price_per_night * nights).toFixed(2)} {t('room.total')}</div>
                        <button className={styles.btnSelect} onClick={() => handleSelectRoom(room)}>
                          {isExpanded ? t('room.close') : room.has_packages ? t('room.selectPackage') : t('room.select')}
                        </button>
                      </div>

                      {/* Package picker */}
                      {isExpanded && (
                        <div className={styles.packagePicker}>
                          <p className={styles.pkgTitle}>{t('room.choosePackage')}</p>
                          {packagesLoading && !pkgs.length ? (
                            <div className={styles.pkgLoading}><div className={styles.spinner} /></div>
                          ) : pkgs.length === 0 ? (
                            <p className={styles.pkgEmpty}>{t('room.noPackages')}</p>
                          ) : (
                            pkgs.map(pkg => (
                              <label
                                key={pkg.rate_plan_id}
                                className={`${styles.pkgOption} ${selectedPackage?.rate_plan_id === pkg.rate_plan_id ? styles.pkgSelected : ''}`}
                              >
                                <input
                                  type="radio"
                                  name={`pkg-${room.room_type_id}`}
                                  checked={selectedPackage?.rate_plan_id === pkg.rate_plan_id}
                                  onChange={() => setSelectedPackage(pkg)}
                                  className={styles.pkgRadio}
                                />
                                <div className={styles.pkgInfo}>
                                  <span className={styles.pkgName}>{pkg.plan_name}</span>
                                  {pkg.plan_description && <span className={styles.pkgDesc}>{pkg.plan_description}</span>}
                                </div>
                                <div className={styles.pkgPrices}>
                                  <span className={styles.pkgPrice}>€{Number(pkg.price_per_night).toFixed(2)}</span>
                                  <span className={styles.pkgPriceSub}>{t('room.perNight')}</span>
                                </div>
                              </label>
                            ))
                          )}
                          <div className={styles.pkgActions}>
                            <button className={styles.btnSecondary} onClick={() => { setExpandedRoom(null); setSelectedPackage(null) }}>
                              {t('room.changeDates')}
                            </button>
                            <button
                              className={styles.btnPrimary}
                              onClick={() => handleConfirmPackage(room)}
                              disabled={!selectedPackage && pkgs.length > 0}
                            >
                              {t('room.continue')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Guest info */}
        {step === 2 && selectedRoom && (
          <div className={styles.stepContent}>
            <button className={styles.btnBack} onClick={() => setStep(1)}>{t('common:back')}</button>
            <h2 className={styles.stepTitle}>{t('guest.title')}</h2>

            <div className={styles.summaryBox}>
              <strong>
                {selectedRoom.name}
                {selectedPackage && <span className={styles.summaryPackage}> — {selectedPackage.plan_name}</span>}
              </strong>
              <span className={styles.summaryMeta}>
                {formatDate(checkIn, lang)} — {formatDate(checkOut, lang)} · {t('date.nights', { count: nights })} · €{totalAmount.toFixed(2)}
              </span>
            </div>

            <div className={styles.guestGrid}>
              <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                <label>{t('guest.nameRequired')}</label>
                <input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Marko Marković" />
              </div>
              <div className={styles.field}>
                <label>{t('guest.emailRequired')}</label>
                <input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="marko@email.com" />
              </div>
              <div className={styles.field}>
                <label>{t('guest.phone')}</label>
                <input type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="+382 67 000 000" />
              </div>
              <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                <label>{t('guest.requests')}</label>
                <textarea
                  value={specialRequests}
                  onChange={e => setSpecialRequests(e.target.value)}
                  placeholder={t('guest.requestsPlaceholder')}
                  rows={3}
                  className={styles.textarea}
                />
              </div>
            </div>
            {payError && <p className={styles.error}>{payError}</p>}
            <button className={styles.btnPrimary} onClick={handleToPayment}>
              {t('guest.continue')}
            </button>
          </div>
        )}

        {/* Step 3: Payment summary */}
        {step === 3 && selectedRoom && (
          <div className={styles.stepContent}>
            <button className={styles.btnBack} onClick={() => setStep(2)}>{t('common:back')}</button>
            <h2 className={styles.stepTitle}>{t('payment.title')}</h2>

            <div className={styles.summaryFull}>
              <div className={styles.summaryRow}>
                <span>{t('payment.accommodation')}</span>
                <span>{selectedRoom.name}</span>
              </div>
              {selectedPackage && (
                <div className={styles.summaryRow}>
                  <span>{t('payment.package')}</span>
                  <span>{selectedPackage.plan_name}</span>
                </div>
              )}
              <div className={styles.summaryRow}>
                <span>{t('payment.checkIn')}</span>
                <span>{formatDate(checkIn, lang)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>{t('payment.checkOut')}</span>
                <span>{formatDate(checkOut, lang)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>{t('payment.stay')}</span>
                <span>{t('payment.nights', { count: nights })}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>{t('payment.guests')}</span>
                <span>
                  {children > 0
                    ? t('payment.adultsAndChildren', { adults, children })
                    : t('payment.adultsOnly', { adults })}
                </span>
              </div>
              <div className={styles.summaryRow}>
                <span>{t('payment.guest')}</span>
                <span>{guestName}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>{t('payment.email')}</span>
                <span>{guestEmail}</span>
              </div>
              <div className={styles.summaryDivider} />
              <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                <span>{t('payment.total')}</span>
                <span>€{totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {selectedPackage?.payment_type !== 'on_arrival' && paymentProvider && (
              <p className={styles.paypalNote}>{t('payment.secureNote')}</p>
            )}
            {payError && <p className={styles.error}>{payError}</p>}
            {selectedPackage?.payment_type === 'on_arrival' ? (
              <button className={styles.btnOnArrival} onClick={handlePayOnArrival} disabled={payLoading}>
                {payLoading ? t('payment.paying') : t('payment.payOnArrival')}
              </button>
            ) : paymentProvider ? (
              <button className={styles.btnPaypal} onClick={handlePayOnline} disabled={payLoading}>
                {payLoading ? t('payment.paying') : t('payment.payNow')}
              </button>
            ) : (
              <div className={styles.noPaymentNote}>
                {t('payment.noOnlinePayment', 'Online plaćanje nije dostupno za ovaj objekat. Odaberite plaćanje na recepciji ili kontaktirajte hotel direktno.')}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className={styles.stepContent}>
            {!confirmation && !payError && (
              <div className={styles.processing}>
                <div className={styles.spinner} />
                <p>{t('confirm.processing')}</p>
              </div>
            )}
            {payError && (
              <div className={styles.errorBlock}>
                <div className={styles.errorIcon}>⚠️</div>
                <h3>{t('confirm.errorTitle')}</h3>
                <p>{payError}</p>
                <button className={styles.btnSecondary} onClick={() => { setStep(3); setPayError('') }}>
                  {t('confirm.retry')}
                </button>
              </div>
            )}
            {confirmation && (
              <div className={styles.confirmBlock}>
                <div className={styles.confirmIcon}>{confirmation.booking_mode === 'manual' ? '📋' : '✅'}</div>
                <h2 className={styles.confirmTitle}>
                  {confirmation.booking_mode === 'manual' ? t('confirm.titleReceived') : t('confirm.title')}
                </h2>
                <p className={styles.confirmSub}>
                  <Trans
                    i18nKey={confirmation.booking_mode === 'manual' ? 'confirm.subReceived' : 'confirm.sub'}
                    ns="booking"
                    values={{ name: confirmation.guest_name, email: confirmation.guest_email }}
                    components={{ strong: <strong /> }}
                  />
                </p>
                <div className={styles.confirmDetails}>
                  <div className={styles.confirmRow}>
                    <span>{t('confirm.refNum')}</span>
                    <span className={styles.confirmCode}>{confirmation.reservation_id?.slice(0, 8).toUpperCase()}</span>
                  </div>
                  <div className={styles.confirmRow}>
                    <span>{t('confirm.accommodation')}</span>
                    <span>{confirmation.room_type_name}</span>
                  </div>
                  <div className={styles.confirmRow}>
                    <span>{t('confirm.checkIn')}</span>
                    <span>{formatDate(confirmation.check_in, lang)}</span>
                  </div>
                  <div className={styles.confirmRow}>
                    <span>{t('confirm.checkOut')}</span>
                    <span>{formatDate(confirmation.check_out, lang)}</span>
                  </div>
                  <div className={styles.confirmRow}>
                    <span>{t('confirm.paid')}</span>
                    <span>€{Number(confirmation.total_amount).toFixed(2)}</span>
                  </div>
                </div>
                <a href={`/${slug}`} className={styles.btnSecondary}>{t('confirm.backToMenu')}</a>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <span>Powered by RestByMe</span>
      </div>
    </div>
  )
}
