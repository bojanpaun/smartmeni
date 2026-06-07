import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import styles from './GuestApp.module.css'

const TODAY = new Date().toISOString().slice(0, 10)
function addDays(d, n) { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10) }
function fmtDate(d) { return new Date(d + 'T12:00:00').toLocaleDateString('sr-Latn', { weekday: 'long', day: 'numeric', month: 'long' }) }
function fmtDateEn(d) { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }) }

const CAT_ICON  = { massage: '💆', facial: '✨', body: '🧖', nail: '💅', wellness: '🌿', group: '👥' }
const CAT_LABEL = { massage: 'Masaža', facial: 'Facial', body: 'Tijelo', nail: 'Nokti', wellness: 'Wellness', group: 'Grupni' }
const CAT_LABEL_EN = { massage: 'Massage', facial: 'Facial', body: 'Body', nail: 'Nails', wellness: 'Wellness', group: 'Group' }

const APPT_STATUS = {
  confirmed:  { label: 'Potvrđen',  labelEn: 'Confirmed',  color: '#2563eb' },
  checked_in: { label: 'Aktivan',   labelEn: 'Active',     color: '#0d7a52' },
  completed:  { label: 'Završen',   labelEn: 'Completed',  color: '#6b7280' },
  cancelled:  { label: 'Otkazan',   labelEn: 'Cancelled',  color: '#c0392b' },
  no_show:    { label: 'No-show',   labelEn: 'No-show',    color: '#ef9f27' },
}

export default function GuestSpaTab({ restaurantId, session, isEn }) {
  const [view, setView] = useState('overview') // overview | book
  const [step, setStep] = useState(0)

  // Existing appointments
  const [appointments, setAppointments] = useState([])
  const [reviewedIds, setReviewedIds] = useState(() => new Set())
  const [apptLoading, setApptLoading] = useState(true)

  // Booking flow state
  const [services, setServices] = useState([])
  const [catFilter, setCatFilter] = useState('all')
  const [selectedService, setSelectedService] = useState(null)
  const [therapists, setTherapists] = useState([])
  const [date, setDate] = useState(addDays(TODAY, 1))
  const [therapistPref, setTherapistPref] = useState('any')
  const [slots, setSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [guestNotes, setGuestNotes] = useState('')
  const [booking, setBooking] = useState(false)
  const [bookError, setBookError] = useState('')
  const [confirmation, setConfirmation] = useState(null)

  // Load appointments & services
  useEffect(() => {
    if (!restaurantId || !session?.id) return
    setApptLoading(true)
    supabase.from('spa_appointments')
      .select('id, appointment_date, start_time, end_time, duration_minutes, status, price, spa_services(name, category), spa_rooms(name)')
      .eq('restaurant_id', restaurantId)
      .eq('hotel_reservation_id', session.id)
      .not('status', 'in', '(cancelled,no_show)')
      .order('appointment_date')
      .order('start_time')
      .then(({ data }) => { setAppointments(data ?? []); setApptLoading(false) })

    supabase.from('spa_services')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('category')
      .then(({ data }) => setServices(data ?? []))
  }, [restaurantId, session?.id])

  // Load therapists when service selected
  useEffect(() => {
    if (!selectedService || !restaurantId) return
    supabase.from('spa_therapists')
      .select('id, staff!staff_id(first_name, last_name), spa_therapist_services!inner(service_id)')
      .eq('restaurant_id', restaurantId)
      .eq('is_available', true)
      .eq('spa_therapist_services.service_id', selectedService.id)
      .then(({ data }) => setTherapists(data ?? []))
  }, [selectedService, restaurantId])

  // Load slots on step 2
  useEffect(() => {
    if (step !== 2 || !selectedService) return
    setSlotsLoading(true)
    setSlots([])
    setSelectedSlot(null)
    supabase.rpc('get_available_spa_slots', {
      p_restaurant_id: restaurantId,
      p_service_id:    selectedService.id,
      p_date:          date,
      p_therapist_id:  therapistPref === 'any' ? null : therapistPref,
    }).then(({ data }) => {
      const seen = new Set()
      const unique = (data ?? []).filter(s => {
        if (seen.has(s.slot_start)) return false
        seen.add(s.slot_start)
        return true
      })
      setSlots(unique)
      setSlotsLoading(false)
    })
  }, [step, selectedService, date, therapistPref, restaurantId])

  const startBooking = () => {
    setView('book')
    setStep(0)
    setSelectedService(null)
    setSelectedSlot(null)
    setGuestNotes('')
    setBookError('')
    setConfirmation(null)
    setCatFilter('all')
    setDate(addDays(TODAY, 1))
    setTherapistPref('any')
  }

  const cancelBooking = () => {
    setView('overview')
    setConfirmation(null)
  }

  const handleConfirm = async () => {
    if (!selectedSlot || !selectedService) return
    setBooking(true)
    setBookError('')

    const { data, error } = await supabase.rpc('book_spa_appointment', {
      p_restaurant_id:    restaurantId,
      p_service_id:       selectedService.id,
      p_therapist_id:     selectedSlot.therapist_id,
      p_spa_room_id:      selectedSlot.spa_room_id,
      p_date:             date,
      p_start_time:       selectedSlot.slot_start,
      p_end_time:         selectedSlot.slot_end,
      p_duration_minutes: selectedService.duration_minutes,
      p_price:            selectedSlot.price ?? selectedService.price,
      p_guest_name:       session.guest_name,
      p_guest_email:      session.guest_email || '',
      p_guest_notes:      guestNotes || null,
      p_payment_method:   'folio',
      p_reservation_code: session.reservation_code || null,
    })

    setBooking(false)
    if (error || data?.error) {
      setBookError(data?.error || (isEn ? 'Booking error. Please try again.' : 'Greška pri rezervaciji. Pokušajte ponovo.'))
      return
    }
    setConfirmation({ service: selectedService, slot: selectedSlot, date })
    // Refresh appointments
    supabase.from('spa_appointments')
      .select('id, appointment_date, start_time, end_time, duration_minutes, status, price, spa_services(name, category), spa_rooms(name)')
      .eq('restaurant_id', restaurantId)
      .eq('hotel_reservation_id', session.id)
      .not('status', 'in', '(cancelled,no_show)')
      .order('appointment_date').order('start_time')
      .then(({ data: d }) => setAppointments(d ?? []))
  }

  // ── OVERVIEW ──────────────────────────────────────────────────
  if (view === 'overview') return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
          {isEn ? '✨ Spa & Wellness' : '✨ Spa & Wellness'}
        </div>
        <button className={styles.btnPrimary} onClick={startBooking} style={{ padding: '9px 18px', fontSize: 13 }}>
          {isEn ? '+ Book treatment' : '+ Rezerviši tretman'}
        </button>
      </div>

      {apptLoading ? (
        <div className={styles.loading}><div className={styles.spinner} /></div>
      ) : appointments.length === 0 ? (
        <div className={styles.emptyState}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>💆</div>
          <div style={{ fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            {isEn ? 'No spa appointments yet' : 'Nemate spa termina'}
          </div>
          <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>
            {isEn ? 'Book a treatment and enjoy your stay.' : 'Rezervišite tretman i uživajte u boravku.'}
          </div>
          <button className={styles.btnPrimary} onClick={startBooking} style={{ padding: '10px 24px' }}>
            {isEn ? 'Browse treatments' : 'Pogledaj tretmane'}
          </button>
        </div>
      ) : (
        <div>
          {appointments.map(appt => {
            const st = APPT_STATUS[appt.status] || APPT_STATUS.confirmed
            return (
              <div key={appt.id} className={styles.infoCard} style={{ marginBottom: 10, borderLeft: `4px solid ${st.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>
                    {appt.spa_services?.name}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: st.color, background: `${st.color}18`, padding: '2px 8px', borderRadius: 20 }}>
                    {isEn ? st.labelEn : st.label}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>
                  📅 {isEn ? fmtDateEn(appt.appointment_date) : fmtDate(appt.appointment_date)}
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                  🕐 {appt.start_time?.slice(0, 5)} – {appt.end_time?.slice(0, 5)} · {appt.duration_minutes} min
                </div>
                {appt.spa_rooms?.name && (
                  <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>🚪 {appt.spa_rooms.name}</div>
                )}
                <div style={{ fontSize: 13, color: '#0d7a52', fontWeight: 600, marginTop: 6 }}>
                  €{parseFloat(appt.price).toFixed(2)} — {isEn ? 'billed to folio' : 'na hotelski folio'}
                </div>
                {appt.status === 'completed' && (
                  <ReviewRow
                    apptId={appt.id}
                    isEn={isEn}
                    done={reviewedIds.has(appt.id)}
                    onDone={() => setReviewedIds(s => new Set(s).add(appt.id))}
                  />
                )}
              </div>
            )
          })}
          <button className={styles.btnSecondary} onClick={startBooking} style={{ width: '100%', marginTop: 8, padding: '11px' }}>
            {isEn ? '+ Book another treatment' : '+ Rezerviši još jedan tretman'}
          </button>
        </div>
      )}
    </div>
  )

  // ── BOOKING FLOW ──────────────────────────────────────────────

  // Confirmation screen
  if (confirmation) return (
    <div className={styles.emptyState} style={{ padding: '32px 16px' }}>
      <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
      <div style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>
        {isEn ? 'Treatment booked!' : 'Termin rezervisan!'}
      </div>
      <div style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>
        {confirmation.service.name}
      </div>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
        {isEn ? fmtDateEn(confirmation.date) : fmtDate(confirmation.date)} · {confirmation.slot.slot_start?.slice(0,5)}
      </div>
      <div style={{ fontSize: 13, color: '#0d7a52', fontWeight: 600, marginBottom: 24 }}>
        {isEn ? 'Added to your folio.' : 'Dodano na vaš hotelski folio.'}
      </div>
      <button className={styles.btnPrimary} onClick={cancelBooking} style={{ padding: '11px 28px' }}>
        {isEn ? '← Back to spa' : '← Nazad na spa'}
      </button>
    </div>
  )

  const filteredServices = catFilter === 'all' ? services : services.filter(s => s.category === catFilter)
  const categories = [...new Set(services.map(s => s.category))]

  return (
    <div>
      {/* Booking header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={cancelBooking}
          style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 18, cursor: 'pointer', padding: '4px 8px' }}>
          ←
        </button>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>
          {isEn ? 'Book a treatment' : 'Rezerviši tretman'}
        </div>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i <= step ? '#0d7a52' : '#e5e7eb',
            transition: 'background 0.2s'
          }} />
        ))}
      </div>

      {/* ── STEP 0: Services ── */}
      {step === 0 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
            {isEn ? 'Choose a treatment' : 'Odaberite tretman'}
          </div>
          {/* Category filter */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {['all', ...categories].map(cat => (
              <button key={cat}
                onClick={() => setCatFilter(cat)}
                style={{
                  padding: '5px 12px', borderRadius: 20, border: '1.5px solid',
                  borderColor: catFilter === cat ? '#0d7a52' : '#e5e7eb',
                  background: catFilter === cat ? '#f0fdf4' : 'transparent',
                  color: catFilter === cat ? '#0d7a52' : '#6b7280',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {cat === 'all' ? (isEn ? 'All' : 'Sve') : `${CAT_ICON[cat] || '✨'} ${isEn ? CAT_LABEL_EN[cat] || cat : CAT_LABEL[cat] || cat}`}
              </button>
            ))}
          </div>
          {filteredServices.map(svc => (
            <div key={svc.id} className={styles.infoCard}
              style={{ marginBottom: 10, cursor: 'pointer', transition: 'box-shadow 0.15s',
                border: selectedService?.id === svc.id ? '2px solid #0d7a52' : '1px solid #e5e7eb' }}
              onClick={() => setSelectedService(svc)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{svc.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
                    ⏱ {svc.duration_minutes} min · {CAT_ICON[svc.category] || '✨'} {isEn ? CAT_LABEL_EN[svc.category] || svc.category : CAT_LABEL[svc.category] || svc.category}
                  </div>
                  {svc.description && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{svc.description}</div>}
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#0d7a52', flexShrink: 0, marginLeft: 12 }}>
                  €{parseFloat(svc.price).toFixed(2)}
                </div>
              </div>
            </div>
          ))}
          <button className={styles.btnPrimary}
            style={{ width: '100%', marginTop: 8, padding: '13px', opacity: selectedService ? 1 : 0.4 }}
            disabled={!selectedService}
            onClick={() => setStep(1)}>
            {isEn ? 'Continue →' : 'Nastavi →'}
          </button>
        </div>
      )}

      {/* ── STEP 1: Date + Therapist ── */}
      {step === 1 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
            {isEn ? 'Select date & therapist' : 'Odaberite datum i terapeuta'}
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>
              {isEn ? 'DATE' : 'DATUM'}
            </div>
            <input type="date" value={date} min={addDays(TODAY, 1)}
              onChange={e => setDate(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb',
                borderRadius: 10, fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>
              {isEn ? 'THERAPIST PREFERENCE' : 'TERAPEUT (opciono)'}
            </div>
            <select value={therapistPref} onChange={e => setTherapistPref(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb',
                borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
              <option value="any">{isEn ? 'No preference (first available)' : 'Bez preferencije (prvi slobodni)'}</option>
              {therapists.map(t => (
                <option key={t.id} value={t.id}>
                  {t.staff?.first_name} {t.staff?.last_name}
                </option>
              ))}
            </select>
          </div>

          {/* Summary */}
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d', marginBottom: 4 }}>{selectedService.name}</div>
            <div style={{ fontSize: 12, color: '#16a34a' }}>⏱ {selectedService.duration_minutes} min · €{parseFloat(selectedService.price).toFixed(2)} · {isEn ? 'folio' : 'folio'}</div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className={styles.btnSecondary} style={{ flex: 1, padding: '12px' }} onClick={() => setStep(0)}>← {isEn ? 'Back' : 'Nazad'}</button>
            <button className={styles.btnPrimary} style={{ flex: 2, padding: '12px' }} onClick={() => setStep(2)}>
              {isEn ? 'See available times →' : 'Slobodni termini →'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Slots ── */}
      {step === 2 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            {isEn ? 'Available times' : 'Slobodni termini'}
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>
            {isEn ? fmtDateEn(date) : fmtDate(date)}
          </div>

          {slotsLoading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
              {isEn ? 'Loading...' : 'Učitavanje...'}
            </div>
          ) : slots.length === 0 ? (
            <div className={styles.emptyState} style={{ padding: '24px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🗓️</div>
              <div style={{ fontSize: 14, color: '#6b7280' }}>
                {isEn ? 'No available times for this date.' : 'Nema slobodnih termina za ovaj datum.'}
              </div>
              <button className={styles.btnSecondary} style={{ marginTop: 12, padding: '9px 20px' }} onClick={() => setStep(1)}>
                {isEn ? 'Change date' : 'Promijeni datum'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              {slots.map((slot, i) => (
                <button key={i}
                  onClick={() => setSelectedSlot(slot)}
                  style={{
                    padding: '12px 8px', borderRadius: 12, border: '2px solid',
                    borderColor: selectedSlot === slot ? '#0d7a52' : '#e5e7eb',
                    background: selectedSlot === slot ? '#f0fdf4' : '#fff',
                    color: selectedSlot === slot ? '#0d7a52' : '#374151',
                    fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.12s',
                  }}>
                  {slot.slot_start?.slice(0, 5)}
                </button>
              ))}
            </div>
          )}

          {slots.length > 0 && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button className={styles.btnSecondary} style={{ flex: 1, padding: '12px' }} onClick={() => setStep(1)}>← {isEn ? 'Back' : 'Nazad'}</button>
              <button className={styles.btnPrimary} style={{ flex: 2, padding: '12px', opacity: selectedSlot ? 1 : 0.4 }}
                disabled={!selectedSlot} onClick={() => setStep(3)}>
                {isEn ? 'Continue →' : 'Nastavi →'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: Confirm ── */}
      {step === 3 && selectedSlot && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 14 }}>
            {isEn ? 'Confirm booking' : 'Potvrdite rezervaciju'}
          </div>

          {/* Summary card */}
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 14, padding: 18, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#15803d', marginBottom: 8 }}>{selectedService.name}</div>
            <div style={{ fontSize: 13, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div>📅 {isEn ? fmtDateEn(date) : fmtDate(date)}</div>
              <div>🕐 {selectedSlot.slot_start?.slice(0,5)} – {selectedSlot.slot_end?.slice(0,5)}</div>
              <div>⏱ {selectedService.duration_minutes} min</div>
              {selectedSlot.tname && <div>👤 {selectedSlot.tname}</div>}
              {selectedSlot.room_name && <div>🚪 {selectedSlot.room_name}</div>}
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #bbf7d0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18, color: '#15803d' }}>€{parseFloat(selectedSlot.price || selectedService.price).toFixed(2)}</div>
                <div style={{ fontSize: 11, color: '#16a34a' }}>🧾 {isEn ? 'Billed to room folio' : 'Na hotelski folio sobe'}</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #86efac', borderRadius: 10, padding: '6px 14px',
                fontSize: 12, fontWeight: 600, color: '#0d7a52' }}>
                {isEn ? 'No upfront payment' : 'Bez plaćanja unaprijed'}
              </div>
            </div>
          </div>

          {/* Guest info */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>
              {isEn ? 'GUEST' : 'GOST'}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{session.guest_name}</div>
          </div>

          {/* Notes */}
          <textarea
            value={guestNotes}
            onChange={e => setGuestNotes(e.target.value)}
            placeholder={isEn ? 'Special requests or notes (optional)...' : 'Posebni zahtjevi ili napomene (opciono)...'}
            rows={3}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px',
              border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13,
              fontFamily: 'inherit', outline: 'none', resize: 'none', marginBottom: 12 }}
          />

          {bookError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
              borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>
              {bookError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className={styles.btnSecondary} style={{ flex: 1, padding: '12px' }} onClick={() => setStep(2)}>← {isEn ? 'Back' : 'Nazad'}</button>
            <button className={styles.btnPrimary} style={{ flex: 2, padding: '12px' }}
              onClick={handleConfirm} disabled={booking}>
              {booking ? (isEn ? 'Booking...' : 'Rezervacija...') : (isEn ? '✓ Confirm booking' : '✓ Potvrdi rezervaciju')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Ocjena završenog termina (gost). submit_spa_review je SECURITY DEFINER pa ne
// treba write pristup spa_reviews tabeli.
function ReviewRow({ apptId, isEn, done, onDone }) {
  const [rating, setRating] = useState(0)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(done)

  if (sent) return (
    <div style={{ fontSize: 12, color: '#0d7a52', marginTop: 8 }}>
      ★ {isEn ? 'Thanks for your rating!' : 'Hvala na ocjeni!'}
    </div>
  )

  const submit = async (r) => {
    setRating(r); setBusy(true)
    const { error } = await supabase.rpc('submit_spa_review', { p_appointment_id: apptId, p_rating: r })
    setBusy(false)
    if (!error) { setSent(true); onDone?.() }
  }

  return (
    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 12, color: '#6b7280', marginRight: 4 }}>{isEn ? 'Rate:' : 'Ocijeni:'}</span>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          disabled={busy}
          onClick={() => submit(n)}
          aria-label={`${n}`}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0, color: n <= rating ? '#f59e0b' : '#d1d5db' }}
        >★</button>
      ))}
    </div>
  )
}
