import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'
import styles from './OnboardingWizard.module.css'

// Hotel setup wizard — on-demand (dugme u ControlPanel hubu, hotel vertikala).
// Koraci: tip sobe → sobe → booking vrijeme → gotovo. INSERT-i imaju re-run
// zaštitu (room_type po nazivu; rooms preko UNIQUE(restaurant_id, room_number)).

const STEPS = [
  { id: 'roomtype', icon: '🛏️', title: 'Tip sobe',       desc: 'Npr. Standard, Deluxe — naziv, cijena i kapacitet' },
  { id: 'rooms',    icon: '🚪', title: 'Sobe',           desc: 'Dodaj konkretne sobe za ovaj tip' },
  { id: 'booking',  icon: '🕒', title: 'Booking vrijeme', desc: 'Vrijeme check-in i check-out' },
  { id: 'done',     icon: '🏨', title: 'Gotovo',         desc: 'Hotel je spreman za rad' },
]

export default function HotelOnboardingWizard({ onComplete, onSkip, markComplete = false }) {
  const { restaurant, setRestaurant } = usePlatform()

  // Kad je wizard auto-prikazan (hotel-only novi tenant), na kraj/skip
  // markiramo onboarding_completed da se ne pali ponovo. Button-launch ne dira flag.
  const finishOnboarding = async () => {
    if (!markComplete || restaurant?.onboarding_completed) return
    await supabase.from('restaurants').update({ onboarding_completed: true }).eq('id', restaurant.id)
    setRestaurant({ ...restaurant, onboarding_completed: true })
  }
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  const [rt, setRt] = useState({ name: '', basePrice: '', maxOccupancy: '2' })
  const [createdTypeId, setCreatedTypeId] = useState(null)
  const [room, setRoom] = useState({ number: '', floor: '' })
  const [addedRooms, setAddedRooms] = useState([])
  const [roomMsg, setRoomMsg] = useState('')
  const [booking, setBooking] = useState({
    checkin: restaurant?.booking_checkin_time || '14:00',
    checkout: restaurant?.booking_checkout_time || '11:00',
  })

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  const addRoom = async () => {
    if (!room.number.trim() || !createdTypeId) return
    setRoomMsg('')
    const { error } = await supabase.from('rooms').insert({
      restaurant_id: restaurant.id,
      room_type_id: createdTypeId,
      room_number: room.number.trim(),
      floor: room.floor ? parseInt(room.floor, 10) : null,
      status: 'available',
    })
    if (error) {
      // UNIQUE(restaurant_id, room_number) → soba već postoji
      setRoomMsg(error.code === '23505' ? `Soba ${room.number.trim()} već postoji.` : 'Greška pri dodavanju.')
      return
    }
    setAddedRooms(list => [...list, room.number.trim()])
    setRoom({ number: '', floor: room.floor })
  }

  const handleNext = async () => {
    setSaving(true)
    try {
      if (current.id === 'roomtype' && rt.name.trim()) {
        // Re-run zaštita: ako tip s tim nazivom postoji, koristi njega.
        const { data: existing } = await supabase.from('room_types')
          .select('id').eq('restaurant_id', restaurant.id).eq('name', rt.name.trim()).maybeSingle()
        if (existing) {
          setCreatedTypeId(existing.id)
        } else {
          const { data } = await supabase.from('room_types').insert({
            restaurant_id: restaurant.id,
            name: rt.name.trim(),
            base_price: rt.basePrice ? parseFloat(rt.basePrice) : null,
            max_occupancy: rt.maxOccupancy ? parseInt(rt.maxOccupancy, 10) : 2,
          }).select().single()
          if (data) setCreatedTypeId(data.id)
        }
      }

      if (current.id === 'booking') {
        await supabase.from('restaurants')
          .update({ booking_checkin_time: booking.checkin, booking_checkout_time: booking.checkout })
          .eq('id', restaurant.id)
        setRestaurant({ ...restaurant, booking_checkin_time: booking.checkin, booking_checkout_time: booking.checkout })
      }

      if (isLast) {
        await finishOnboarding()
        onComplete?.()
        navigate('/admin/hotel/frontdesk')
        return
      }
      setStep(s => s + 1)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleSkipAll = async () => { await finishOnboarding(); onSkip?.(); navigate('/admin/hotel') }

  const canProceed = () => {
    if (current.id === 'roomtype') return rt.name.trim().length > 0
    return true
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.wizard}>

        <div className={styles.wizardHeader}>
          <div className={styles.wizardTitle}>Postavljanje hotela</div>
          <button className={styles.skipAllBtn} onClick={handleSkipAll}>Preskoči sve →</button>
        </div>

        <div className={styles.progress}>
          {STEPS.map((s, i) => (
            <div key={s.id}
              className={`${styles.progressStep} ${i < step ? styles.progressDone : ''} ${i === step ? styles.progressActive : ''}`}
              onClick={() => i < step && setStep(i)}>
              <div className={styles.progressDot}>{i < step ? '✓' : i + 1}</div>
              <div className={styles.progressLabel}>{s.title}</div>
            </div>
          ))}
        </div>

        <div className={styles.stepContent}>
          <div className={styles.stepIcon}>{current.icon}</div>
          <h2 className={styles.stepTitle}>{current.title}</h2>
          <p className={styles.stepDesc}>{current.desc}</p>

          {/* TIP SOBE */}
          {current.id === 'roomtype' && (
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Naziv tipa *</label>
                <input value={rt.name} onChange={e => setRt(p => ({ ...p, name: e.target.value }))}
                  placeholder="npr. Standard dvokrevetna" autoFocus />
              </div>
              <div className={styles.formRow}>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label>Cijena/noć (€)</label>
                  <input type="number" step="0.50" min="0" value={rt.basePrice}
                    onChange={e => setRt(p => ({ ...p, basePrice: e.target.value }))} placeholder="60" />
                </div>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label>Max gostiju</label>
                  <input type="number" min="1" value={rt.maxOccupancy}
                    onChange={e => setRt(p => ({ ...p, maxOccupancy: e.target.value }))} placeholder="2" />
                </div>
              </div>
            </div>
          )}

          {/* SOBE */}
          {current.id === 'rooms' && (
            <div className={styles.simpleForm}>
              <div className={styles.formRow}>
                <div className={styles.field} style={{ flex: 2 }}>
                  <label>Broj sobe</label>
                  <input value={room.number} onChange={e => setRoom(p => ({ ...p, number: e.target.value }))}
                    placeholder="npr. 101" onKeyDown={e => { if (e.key === 'Enter') addRoom() }} autoFocus />
                </div>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label>Sprat</label>
                  <input type="number" value={room.floor} onChange={e => setRoom(p => ({ ...p, floor: e.target.value }))}
                    placeholder="1" />
                </div>
                <button className={styles.nextBtn} style={{ alignSelf: 'flex-end', height: 40 }}
                  onClick={addRoom} disabled={!room.number.trim()}>+ Dodaj</button>
              </div>
              {roomMsg && <div style={{ color: 'var(--c-danger)', fontSize: 13, marginTop: 6 }}>{roomMsg}</div>}
              {addedRooms.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  {addedRooms.map((n, i) => (
                    <span key={i} style={{ padding: '4px 10px', background: 'var(--c-primary-light)', color: 'var(--c-primary)', borderRadius: 12, fontSize: 13 }}>🚪 {n}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* BOOKING */}
          {current.id === 'booking' && (
            <div className={styles.formRow}>
              <div className={styles.field} style={{ flex: 1 }}>
                <label>Check-in vrijeme</label>
                <input type="time" value={booking.checkin} onChange={e => setBooking(p => ({ ...p, checkin: e.target.value }))} />
              </div>
              <div className={styles.field} style={{ flex: 1 }}>
                <label>Check-out vrijeme</label>
                <input type="time" value={booking.checkout} onChange={e => setBooking(p => ({ ...p, checkout: e.target.value }))} />
              </div>
            </div>
          )}

          {/* DONE */}
          {current.id === 'done' && (
            <div className={styles.qrSection}>
              <div className={styles.qrSuccess}>
                <div className={styles.qrSuccessIcon}>🎉</div>
                <div className={styles.qrSuccessTitle}>Hotel je spreman!</div>
                <div className={styles.qrSuccessDesc}>
                  Kreirao si tip sobe{addedRooms.length > 0 ? ` i ${addedRooms.length} soba` : ''}. Nastavi na Front Desk za rezervacije i check-in.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.wizardFooter}>
          {step > 0 && <button className={styles.backBtn} onClick={() => setStep(s => s - 1)}>← Nazad</button>}
          <div className={styles.footerRight}>
            {!isLast && current.id !== 'roomtype' && (
              <button className={styles.skipStepBtn} onClick={() => setStep(s => s + 1)}>Preskoči</button>
            )}
            <button className={styles.nextBtn} onClick={handleNext} disabled={saving || !canProceed()}>
              {saving ? 'Čuvanje...' : isLast ? '🏨 Otvori Front Desk' : 'Dalje →'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
