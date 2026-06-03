import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePlatform } from '../../../context/PlatformContext'
import { useRooms } from '../hooks/useRooms'
import { supabase } from '../../../lib/supabase'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import styles from './Hotel.module.css'

const EMPTY = {
  guest_name: '', guest_email: '', guest_phone: '',
  room_type_id: '', room_id: '',
  check_in_date: '', check_out_date: '',
  adults: 1, children: 0,
  rate_per_night: '', special_requests: '', internal_notes: '',
  status: 'confirmed', source: 'direct', payment_status: 'pending',
}

export default function ReservationForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { restaurant } = usePlatform()
  const { rooms, roomTypes, loading: loadingRooms } = useRooms(restaurant?.id)
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [reservedRoomIds, setReservedRoomIds] = useState(new Set())

  useEffect(() => {
    if (!id || !restaurant) return
    supabase.from('hotel_reservations').select('*').eq('id', id).single().then(({ data }) => {
      if (data) setForm({
          ...EMPTY, ...data,
          guest_name:       data.guest_name        ?? '',
          guest_email:      data.guest_email       ?? '',
          guest_phone:      data.guest_phone       ?? '',
          room_type_id:     data.room_type_id      ?? '',
          room_id:          data.room_id           ?? '',
          status:           data.status            ?? 'confirmed',
          source:           data.source            ?? 'direct',
          payment_status:   data.payment_status    ?? 'pending',
          special_requests: data.special_requests  ?? '',
          internal_notes:   data.internal_notes    ?? '',
        })
      setLoading(false)
    })
  }, [id, restaurant])

  // Fetch soba zauzete rezervacijom za odabrane datume
  useEffect(() => {
    if (!form.check_in_date || !form.check_out_date || !restaurant?.id) {
      setReservedRoomIds(new Set())
      return
    }
    supabase
      .from('hotel_reservations')
      .select('id, room_id')
      .eq('restaurant_id', restaurant.id)
      .not('room_id', 'is', null)
      .not('status', 'in', '("cancelled","no_show")')
      .lt('check_in_date', form.check_out_date)
      .gt('check_out_date', form.check_in_date)
      .then(({ data }) => {
        // Ako editujemo, ne blokiraj sobu trenutne rezervacije
        const ids = new Set(
          (data ?? [])
            .filter(r => r.id !== id)
            .map(r => r.room_id)
        )
        setReservedRoomIds(ids)
      })
  }, [form.check_in_date, form.check_out_date, restaurant?.id, id])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const nights = form.check_in_date && form.check_out_date
    ? Math.max(0, Math.ceil((new Date(form.check_out_date) - new Date(form.check_in_date)) / 86400000))
    : 0
  const total = nights * (parseFloat(form.rate_per_night) || 0)

  // Slobodne sobe: odgovarajući tip, nije maintenance/blocked, nema rezervacije za ove datume
  const roomsForType = rooms.filter(r => {
    if (form.room_type_id && r.room_type_id !== form.room_type_id) return false
    if (r.status === 'maintenance' || r.status === 'blocked') return false
    if (reservedRoomIds.has(r.id)) return false
    return true
  })

  const handleSave = async () => {
    if (!form.guest_name.trim()) return toast.error('Ime gosta je obavezno')
    if (!form.check_in_date || !form.check_out_date) return toast.error('Datumi su obavezni')
    if (new Date(form.check_out_date) <= new Date(form.check_in_date)) return toast.error('Check-out mora biti poslije check-in datuma')
    setSaving(true)

    // Auto-dodjela sobe: ako nije ručno odabrana, uzmi prvu slobodnu
    let autoRoomId = form.room_id || null
    if (!autoRoomId && form.room_type_id && roomsForType.length > 0) {
      autoRoomId = roomsForType[0].id
      toast(`Soba ${roomsForType[0].room_number} automatski dodijeljena`, { icon: '🛏️' })
    }

    // Provjeri prethodni status PRIJE update-a (za inquiry→confirmed email logiku)
    let prevStatus = null
    if (id && form.status === 'confirmed' && form.source === 'online') {
      const { data: prev } = await supabase
        .from('hotel_reservations').select('status').eq('id', id).single()
      prevStatus = prev?.status ?? null
    }

    const payload = { ...form, restaurant_id: restaurant.id, total_amount: total || null, rate_per_night: parseFloat(form.rate_per_night) || null, room_type_id: form.room_type_id || null, room_id: autoRoomId }
    const { error } = id
      ? await supabase.from('hotel_reservations').update(payload).eq('id', id)
      : await supabase.from('hotel_reservations').insert(payload)
    setSaving(false)
    if (error) return toast.error('Greška pri čuvanju: ' + error.message)

    // Pošalji email potvrde gostu kada admin potvrdi online inquiry
    if (prevStatus === 'inquiry' && form.guest_email) {
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-booking-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_KEY },
        body: JSON.stringify({ reservation_id: id, type: 'confirmed' }),
      }).catch(() => {})
      toast.success('Rezervacija potvrđena — email potvrde je poslan gostu')
    } else {
      toast.success(id ? 'Rezervacija ažurirana' : 'Rezervacija kreirana')
    }
    navigate('/admin/hotel/reservations')
  }

  if (loading || loadingRooms) return <LoadingSpinner fullPage />

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{id ? 'Uredi rezervaciju' : 'Nova rezervacija'}</h1>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={() => navigate('/admin/hotel/reservations')}>Otkaži</button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>{saving ? 'Čuvanje...' : 'Sačuvaj'}</button>
        </div>
      </div>

      <div className={styles.formSections}>
        <section className={styles.formSection}>
          <h3 className={styles.sectionTitle}>Podaci gosta</h3>
          <div className={styles.formGrid}>
            <label className={styles.formLabel}>Ime i prezime *
              <input className={styles.input} value={form.guest_name} onChange={e => set('guest_name', e.target.value)} placeholder="Ime Prezime" />
            </label>
            <label className={styles.formLabel}>Email
              <input className={styles.input} type="email" value={form.guest_email} onChange={e => set('guest_email', e.target.value)} placeholder="email@primjer.com" />
            </label>
            <label className={styles.formLabel}>Telefon
              <input className={styles.input} value={form.guest_phone} onChange={e => set('guest_phone', e.target.value)} placeholder="+387 61 123 456" />
            </label>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Odrasli
                <input className={styles.input} type="number" min={1} max={10} value={form.adults} onChange={e => set('adults', parseInt(e.target.value))} />
              </label>
              <label className={styles.formLabel}>Djeca
                <input className={styles.input} type="number" min={0} max={10} value={form.children} onChange={e => set('children', parseInt(e.target.value))} />
              </label>
            </div>
          </div>
        </section>

        <section className={styles.formSection}>
          <h3 className={styles.sectionTitle}>Smještaj i termini</h3>
          <div className={styles.formGrid}>
            <label className={styles.formLabel}>Tip sobe
              <select className={styles.input} value={form.room_type_id} onChange={e => set('room_type_id', e.target.value)}>
                <option value="">— Odaberi tip —</option>
                {roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name} {rt.base_price ? `(€${rt.base_price}/noć)` : ''}</option>)}
              </select>
            </label>
            <label className={styles.formLabel}>Soba
              <select className={styles.input} value={form.room_id} onChange={e => set('room_id', e.target.value)}>
                <option value="">— Dodijeliti automatski —</option>
                {roomsForType.map(r => <option key={r.id} value={r.id}>{r.room_number}{r.floor != null ? ` (${r.floor}. sprat)` : ''}</option>)}
              </select>
            </label>
            <label className={styles.formLabel}>Check-in *
              <input className={styles.input} type="date" value={form.check_in_date} onChange={e => set('check_in_date', e.target.value)} />
            </label>
            <label className={styles.formLabel}>Check-out *
              <input className={styles.input} type="date" value={form.check_out_date} onChange={e => set('check_out_date', e.target.value)} />
            </label>
            <label className={styles.formLabel}>Cijena po noći (€)
              <input className={styles.input} type="number" min={0} value={form.rate_per_night} onChange={e => set('rate_per_night', e.target.value)} placeholder="0.00" />
            </label>
            {nights > 0 && (
              <div className={styles.totalBox}>
                <span>{nights} noći × €{form.rate_per_night || 0}</span>
                <strong>= €{total.toFixed(2)}</strong>
              </div>
            )}
          </div>
        </section>

        <section className={styles.formSection}>
          <h3 className={styles.sectionTitle}>Status i izvor</h3>
          <div className={styles.formGrid}>
            <label className={styles.formLabel}>Status
              <select className={styles.input} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="inquiry">Upit</option>
                <option value="confirmed">Potvrđena</option>
                <option value="checked_in">Prisutna</option>
                <option value="checked_out">Odjavljena</option>
                <option value="cancelled">Otkazana</option>
                <option value="no_show">No-show</option>
              </select>
            </label>
            <label className={styles.formLabel}>Izvor
              <select className={styles.input} value={form.source} onChange={e => set('source', e.target.value)}>
                <option value="direct">Direktno</option>
                <option value="phone">Telefon</option>
                <option value="walk_in">Walk-in</option>
                <option value="booking_com">Booking.com</option>
                <option value="airbnb">Airbnb</option>
                <option value="expedia">Expedia</option>
              </select>
            </label>
            <label className={styles.formLabel}>Status plaćanja
              <select className={styles.input} value={form.payment_status} onChange={e => set('payment_status', e.target.value)}>
                <option value="pending">Na čekanju</option>
                <option value="partial">Djelimično</option>
                <option value="paid">Plaćeno</option>
                <option value="refunded">Refundirano</option>
              </select>
            </label>
          </div>
        </section>

        <section className={styles.formSection}>
          <h3 className={styles.sectionTitle}>Napomene</h3>
          <div className={styles.formGrid}>
            <label className={styles.formLabel} style={{ gridColumn: '1/-1' }}>Zahtjevi gosta
              <textarea className={styles.textarea} value={form.special_requests} onChange={e => set('special_requests', e.target.value)} rows={2} placeholder="Posebni zahtjevi gosta..." />
            </label>
            <label className={styles.formLabel} style={{ gridColumn: '1/-1' }}>Interne napomene
              <textarea className={styles.textarea} value={form.internal_notes} onChange={e => set('internal_notes', e.target.value)} rows={2} placeholder="Interne napomene (vidljive samo osoblju)..." />
            </label>
          </div>
        </section>
      </div>
    </div>
  )
}
