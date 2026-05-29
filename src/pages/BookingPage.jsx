import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import styles from './BookingPage.module.css'

const STEPS = ['Datumi', 'Soba', 'Podaci', 'Plaćanje', 'Potvrda']

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('bs-BA', { day: '2-digit', month: 'short', year: 'numeric' })
}

function nightsBetween(ci, co) {
  if (!ci || !co) return 0
  return Math.max(0, (new Date(co) - new Date(ci)) / 86400000)
}

export default function BookingPage() {
  const { slug } = useParams()
  const [restaurant, setRestaurant] = useState(null)
  const [loadingRest, setLoadingRest] = useState(true)
  const [step, setStep] = useState(0)

  // Step 0: Dates
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)

  // Step 1: Room search & selection
  const [rooms, setRooms] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [searchError, setSearchError] = useState('')

  // Step 2: Guest info
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [specialRequests, setSpecialRequests] = useState('')

  // Step 3: Payment
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState('')

  // Step 4: Confirmation
  const [confirmation, setConfirmation] = useState(null)

  const nights = nightsBetween(checkIn, checkOut)
  const totalAmount = selectedRoom ? (selectedRoom.price_per_night * nights) : 0

  // Load restaurant by slug
  useEffect(() => {
    supabase
      .from('restaurants')
      .select('id, name, slug, logo_url')
      .eq('slug', slug)
      .single()
      .then(({ data }) => {
        setRestaurant(data)
        setLoadingRest(false)
      })
  }, [slug])

  // On return from PayPal (token in URL)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (!token) return

    const stored = sessionStorage.getItem('booking_pending')
    if (!stored) return

    const pending = JSON.parse(stored)
    setStep(4)
    captureOrder(token, pending)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const searchRooms = async () => {
    if (!checkIn || !checkOut) return setSearchError('Odaberite datume dolaska i odlaska')
    if (nights <= 0) return setSearchError('Datum odlaska mora biti poslije datuma dolaska')
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
    if (error) return setSearchError('Greška pri pretrazi. Pokušajte ponovo.')
    setRooms(data ?? [])
    setStep(1)
  }

  const handleSelectRoom = (room) => {
    setSelectedRoom(room)
    setStep(2)
  }

  const validateGuest = () => {
    if (!guestName.trim()) return 'Ime gosta je obavezno'
    if (!guestEmail.trim() || !guestEmail.includes('@')) return 'Unesite ispravnu e-mail adresu'
    return null
  }

  const handleToPayment = () => {
    const err = validateGuest()
    if (err) return setPayError(err)
    setPayError('')
    setStep(3)
  }

  const handlePay = async () => {
    setPayLoading(true)
    setPayError('')

    const pending = {
      restaurant_id: restaurant.id,
      room_type_id: selectedRoom.room_type_id,
      check_in: checkIn,
      check_out: checkOut,
      adults,
      children,
      guest_name: guestName,
      guest_email: guestEmail,
      guest_phone: guestPhone,
      special_requests: specialRequests,
      price_per_night: selectedRoom.price_per_night,
      total_amount: totalAmount,
    }

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/booking-order-create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_KEY,
          },
          body: JSON.stringify({
            ...pending,
            return_url: `${window.location.origin}/${slug}/book`,
            cancel_url:  `${window.location.origin}/${slug}/book`,
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Greška pri kreiranju narudžbe')

      sessionStorage.setItem('booking_pending', JSON.stringify(pending))
      window.location.href = data.approve_url
    } catch (err) {
      setPayError(err.message)
      setPayLoading(false)
    }
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
          body: JSON.stringify({ paypal_order_id: orderId, ...pending }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Greška pri obradi plaćanja')
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
        <h2>Hotel nije pronađen</h2>
        <p>Provjerite link i pokušajte ponovo.</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        {restaurant.logo_url && (
          <img src={restaurant.logo_url} alt={restaurant.name} className={styles.logo} />
        )}
        <div>
          <h1 className={styles.hotelName}>{restaurant.name}</h1>
          <p className={styles.headerSub}>Online rezervacija</p>
        </div>
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
            <h2 className={styles.stepTitle}>Odaberite datume i broj gostiju</h2>
            <div className={styles.dateGrid}>
              <div className={styles.field}>
                <label>Dolazak</label>
                <input
                  type="date"
                  min={today}
                  value={checkIn}
                  onChange={e => { setCheckIn(e.target.value); if (checkOut && e.target.value >= checkOut) setCheckOut('') }}
                />
              </div>
              <div className={styles.field}>
                <label>Odlazak</label>
                <input
                  type="date"
                  min={minCheckOut}
                  value={checkOut}
                  onChange={e => setCheckOut(e.target.value)}
                  disabled={!checkIn}
                />
              </div>
              <div className={styles.field}>
                <label>Odrasli</label>
                <select value={adults} onChange={e => setAdults(Number(e.target.value))}>
                  {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label>Djeca</label>
                <select value={children} onChange={e => setChildren(Number(e.target.value))}>
                  {[0,1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            {checkIn && checkOut && nights > 0 && (
              <p className={styles.nightsInfo}>{nights} {nights === 1 ? 'noć' : 'noći'} · {formatDate(checkIn)} — {formatDate(checkOut)}</p>
            )}
            {searchError && <p className={styles.error}>{searchError}</p>}
            <button className={styles.btnPrimary} onClick={searchRooms} disabled={searchLoading}>
              {searchLoading ? 'Pretraga...' : 'Provjeri dostupnost →'}
            </button>
          </div>
        )}

        {/* Step 1: Room selection */}
        {step === 1 && (
          <div className={styles.stepContent}>
            <button className={styles.btnBack} onClick={() => setStep(0)}>← Promijeni datume</button>
            <h2 className={styles.stepTitle}>Dostupne sobe</h2>
            <p className={styles.stepSub}>{nights} noći · {formatDate(checkIn)} — {formatDate(checkOut)} · {adults + children} gost(a)</p>

            {rooms.length === 0 ? (
              <div className={styles.noRooms}>
                <div className={styles.noRoomsIcon}>😔</div>
                <p>Nema dostupnih soba za odabrane datume i broj gostiju.</p>
                <button className={styles.btnSecondary} onClick={() => setStep(0)}>Promijeni pretragu</button>
              </div>
            ) : (
              <div className={styles.roomList}>
                {rooms.map(room => (
                  <div key={room.room_type_id} className={styles.roomCard}>
                    {room.images?.length > 0 && (
                      <img src={room.images[0]} alt={room.name} className={styles.roomImg} />
                    )}
                    <div className={styles.roomBody}>
                      <div className={styles.roomName}>{room.name}</div>
                      {room.description && <p className={styles.roomDesc}>{room.description}</p>}
                      <div className={styles.roomMeta}>
                        <span>👥 Do {room.max_occupancy} gosta</span>
                        {room.amenities?.slice(0, 4).map(a => (
                          <span key={a} className={styles.amenity}>{a}</span>
                        ))}
                        {(room.amenities?.length ?? 0) > 4 && (
                          <span className={styles.amenity}>+{room.amenities.length - 4}</span>
                        )}
                      </div>
                    </div>
                    <div className={styles.roomPrice}>
                      <div className={styles.roomPriceVal}>€{Number(room.price_per_night).toFixed(2)}</div>
                      <div className={styles.roomPriceSub}>po noći</div>
                      <div className={styles.roomPriceTotal}>€{(room.price_per_night * nights).toFixed(2)} ukupno</div>
                      <button className={styles.btnSelect} onClick={() => handleSelectRoom(room)}>
                        Rezerviši →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Guest info */}
        {step === 2 && selectedRoom && (
          <div className={styles.stepContent}>
            <button className={styles.btnBack} onClick={() => setStep(1)}>← Nazad</button>
            <h2 className={styles.stepTitle}>Podaci gosta</h2>

            <div className={styles.summaryBox}>
              <strong>{selectedRoom.name}</strong>
              <span className={styles.summaryMeta}>{formatDate(checkIn)} — {formatDate(checkOut)} · {nights} noći · €{totalAmount.toFixed(2)}</span>
            </div>

            <div className={styles.guestGrid}>
              <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                <label>Ime i prezime *</label>
                <input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Marko Marković" />
              </div>
              <div className={styles.field}>
                <label>E-mail *</label>
                <input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="marko@email.com" />
              </div>
              <div className={styles.field}>
                <label>Telefon</label>
                <input type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="+387 61 000 000" />
              </div>
              <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                <label>Posebni zahtjevi</label>
                <textarea
                  value={specialRequests}
                  onChange={e => setSpecialRequests(e.target.value)}
                  placeholder="Alergije, kasni check-in, specifični zahtjevi..."
                  rows={3}
                  className={styles.textarea}
                />
              </div>
            </div>
            {payError && <p className={styles.error}>{payError}</p>}
            <button className={styles.btnPrimary} onClick={handleToPayment}>
              Nastavi na plaćanje →
            </button>
          </div>
        )}

        {/* Step 3: Payment summary */}
        {step === 3 && selectedRoom && (
          <div className={styles.stepContent}>
            <button className={styles.btnBack} onClick={() => setStep(2)}>← Nazad</button>
            <h2 className={styles.stepTitle}>Pregled rezervacije</h2>

            <div className={styles.summaryFull}>
              <div className={styles.summaryRow}>
                <span>Smještaj</span>
                <span>{selectedRoom.name}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Dolazak</span>
                <span>{formatDate(checkIn)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Odlazak</span>
                <span>{formatDate(checkOut)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Boravak</span>
                <span>{nights} {nights === 1 ? 'noć' : 'noći'}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Gosti</span>
                <span>{adults} odrasli{children > 0 ? ` + ${children} djece` : ''}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Gost</span>
                <span>{guestName}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>E-mail</span>
                <span>{guestEmail}</span>
              </div>
              <div className={styles.summaryDivider} />
              <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                <span>Ukupno</span>
                <span>€{totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <p className={styles.paypalNote}>Plaćanje je sigurno i zaštićeno putem PayPal-a.</p>
            {payError && <p className={styles.error}>{payError}</p>}
            <button className={styles.btnPaypal} onClick={handlePay} disabled={payLoading}>
              {payLoading ? 'Priprema plaćanja...' : '💳  Plati putem PayPal-a'}
            </button>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className={styles.stepContent}>
            {!confirmation && !payError && (
              <div className={styles.processing}>
                <div className={styles.spinner} />
                <p>Obrada plaćanja, molimo sačekajte...</p>
              </div>
            )}
            {payError && (
              <div className={styles.errorBlock}>
                <div className={styles.errorIcon}>⚠️</div>
                <h3>Greška pri plaćanju</h3>
                <p>{payError}</p>
                <button className={styles.btnSecondary} onClick={() => { setStep(3); setPayError('') }}>
                  Pokušajte ponovo
                </button>
              </div>
            )}
            {confirmation && (
              <div className={styles.confirmBlock}>
                <div className={styles.confirmIcon}>✅</div>
                <h2 className={styles.confirmTitle}>Rezervacija potvrđena!</h2>
                <p className={styles.confirmSub}>
                  Hvala, <strong>{confirmation.guest_name}</strong>! Potvrda je poslana na <strong>{confirmation.guest_email}</strong>.
                </p>
                <div className={styles.confirmDetails}>
                  <div className={styles.confirmRow}>
                    <span>Br. rezervacije</span>
                    <span className={styles.confirmCode}>{confirmation.reservation_id?.slice(0, 8).toUpperCase()}</span>
                  </div>
                  <div className={styles.confirmRow}>
                    <span>Smještaj</span>
                    <span>{confirmation.room_type_name}</span>
                  </div>
                  <div className={styles.confirmRow}>
                    <span>Dolazak</span>
                    <span>{formatDate(confirmation.check_in)}</span>
                  </div>
                  <div className={styles.confirmRow}>
                    <span>Odlazak</span>
                    <span>{formatDate(confirmation.check_out)}</span>
                  </div>
                  <div className={styles.confirmRow}>
                    <span>Plaćeno</span>
                    <span>€{Number(confirmation.total_amount).toFixed(2)}</span>
                  </div>
                </div>
                <a href={`/${slug}`} className={styles.btnSecondary}>← Povratak na meni</a>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <span>Powered by SmartMeni</span>
      </div>
    </div>
  )
}
