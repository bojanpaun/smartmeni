import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../../context/PlatformContext'
import { useMoney } from '../../../lib/useMoney'
import { useRooms } from '../hooks/useRooms'
import { supabase } from '../../../lib/supabase'
import { logAudit } from '../../../lib/auditLog'
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
  const { t } = useTranslation('admin')
  const money = useMoney()
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
          check_in_date:    data.check_in_date     ?? '',
          check_out_date:   data.check_out_date    ?? '',
          rate_per_night:   data.rate_per_night    ?? '',
          adults:           data.adults            ?? 1,
          children:         data.children          ?? 0,
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
    if (!form.guest_name.trim()) return toast.error(t('htGuestNameRequired'))
    if (!form.check_in_date || !form.check_out_date) return toast.error(t('htDatesRequired'))
    if (new Date(form.check_out_date) <= new Date(form.check_in_date)) return toast.error(t('htCheckoutAfterCheckin'))
    setSaving(true)

    // Auto-dodjela sobe: ako nije ručno odabrana, uzmi prvu slobodnu
    let autoRoomId = form.room_id || null
    if (!autoRoomId && form.room_type_id && roomsForType.length > 0) {
      autoRoomId = roomsForType[0].id
      toast(t('htRoomAutoAssigned', { num: roomsForType[0].room_number }), { icon: '🛏️' })
    }

    // Provjeri prethodni status PRIJE update-a (za inquiry→confirmed email logiku)
    let prevStatus = null
    if (id && form.status === 'confirmed' && form.source === 'online') {
      const { data: prev } = await supabase
        .from('hotel_reservations').select('status').eq('id', id).single()
      prevStatus = prev?.status ?? null
    }

    const payload = { ...form, restaurant_id: restaurant.id, total_amount: total || null, rate_per_night: parseFloat(form.rate_per_night) || null, room_type_id: form.room_type_id || null, room_id: autoRoomId }
    const { data: saved, error } = id
      ? await supabase.from('hotel_reservations').update(payload).eq('id', id).select('id').single()
      : await supabase.from('hotel_reservations').insert(payload).select('id').single()
    setSaving(false)
    if (error) return toast.error(t('htSaveErr') + ': ' + error.message)

    const resId = id || saved?.id
    if (form.status === 'cancelled' || form.status === 'no_show') {
      logAudit({
        restaurantId: restaurant.id,
        action: form.status === 'cancelled' ? 'reservation.cancel' : 'reservation.no_show',
        entityType: 'hotel_reservation', entityId: resId,
        summary: `${form.status === 'cancelled' ? 'Otkazana' : 'No-show'} rezervacija: ${form.guest_name}`,
      })
    } else {
      logAudit({
        restaurantId: restaurant.id,
        action: id ? 'reservation.update' : 'reservation.create',
        entityType: 'hotel_reservation', entityId: resId,
        summary: `${id ? 'Izmijenjena' : 'Nova'} rezervacija: ${form.guest_name} (${form.check_in_date} → ${form.check_out_date})`,
      })
    }

    // Pošalji email potvrde gostu kada admin potvrdi online inquiry.
    // Rezervacija je već sačuvana — neuspjeh emaila NE blokira tok, samo upozorava.
    if (prevStatus === 'inquiry' && form.guest_email) {
      try {
        const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-booking-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_KEY },
          body: JSON.stringify({ reservation_id: id, type: 'confirmed' }),
        })
        if (r.ok) {
          toast.success(t('htResConfirmedEmailSent'))
        } else {
          const d = await r.json().catch(() => ({}))
          console.error('send-booking-email:', d)
          toast(t('htResConfirmedEmailFail'), { icon: '⚠️' })
        }
      } catch (e) {
        console.error('send-booking-email:', e)
        toast(t('htResConfirmedEmailFailShort'), { icon: '⚠️' })
      }
    } else {
      toast.success(id ? t('htResUpdated') : t('htResCreated'))
    }
    navigate('/admin/hotel/reservations')
  }

  if (loading || loadingRooms) return <LoadingSpinner fullPage />

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{id ? t('htEditReservation') : t('htNewReservation')}</h1>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={() => navigate('/admin/hotel/reservations')}>{t('cancel')}</button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>{saving ? t('saving') : t('save')}</button>
        </div>
      </div>

      <div className={styles.formSections}>
        <section className={styles.formSection}>
          <h3 className={styles.sectionTitle}>{t('htGuestData')}</h3>
          <div className={styles.formGrid}>
            <label className={styles.formLabel}>{t('htFullName')} *
              <input className={styles.input} value={form.guest_name} onChange={e => set('guest_name', e.target.value)} placeholder="Ime Prezime" />
            </label>
            <label className={styles.formLabel}>{t('htEmail')}
              <input className={styles.input} type="email" value={form.guest_email} onChange={e => set('guest_email', e.target.value)} placeholder="email@primjer.com" />
            </label>
            <label className={styles.formLabel}>{t('htPhone')}
              <input className={styles.input} value={form.guest_phone} onChange={e => set('guest_phone', e.target.value)} placeholder="+387 61 123 456" />
            </label>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>{t('htAdults')}
                <input className={styles.input} type="number" min={1} max={10} value={form.adults} onChange={e => set('adults', parseInt(e.target.value))} />
              </label>
              <label className={styles.formLabel}>{t('htChildren')}
                <input className={styles.input} type="number" min={0} max={10} value={form.children} onChange={e => set('children', parseInt(e.target.value))} />
              </label>
            </div>
          </div>
        </section>

        <section className={styles.formSection}>
          <h3 className={styles.sectionTitle}>{t('htAccommodationDates')}</h3>
          <div className={styles.formGrid}>
            <label className={styles.formLabel}>{t('htRoomTypeShort')}
              <select className={styles.input} value={form.room_type_id} onChange={e => set('room_type_id', e.target.value)}>
                <option value="">{t('htSelectType')}</option>
                {roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name} {rt.base_price ? `(${t('htPerNight', { price: rt.base_price })})` : ''}</option>)}
              </select>
            </label>
            <label className={styles.formLabel}>{t('htRoomSingular')}
              <select className={styles.input} value={form.room_id} onChange={e => set('room_id', e.target.value)}>
                <option value="">{t('htAutoAssign')}</option>
                {roomsForType.map(r => <option key={r.id} value={r.id}>{r.room_number}{r.floor != null ? ` (${t('htFloorN', { n: r.floor })})` : ''}</option>)}
              </select>
            </label>
            <label className={styles.formLabel}>{t('htCheckin')} *
              <input className={styles.input} type="date" value={form.check_in_date} onChange={e => set('check_in_date', e.target.value)} />
            </label>
            <label className={styles.formLabel}>{t('htCheckout')} *
              <input className={styles.input} type="date" value={form.check_out_date} onChange={e => set('check_out_date', e.target.value)} />
            </label>
            <label className={styles.formLabel}>{t('htFieldPricePerNight')}
              <input className={styles.input} type="number" min={0} value={form.rate_per_night} onChange={e => set('rate_per_night', e.target.value)} placeholder="0.00" />
            </label>
            {nights > 0 && (
              <div className={styles.totalBox}>
                <span>{t('htNightsRate', { n: nights, rate: form.rate_per_night || 0 })}</span>
                <strong>= {money(total)}</strong>
              </div>
            )}
          </div>
        </section>

        <section className={styles.formSection}>
          <h3 className={styles.sectionTitle}>{t('htFieldStatus')} / {t('htFieldSource')}</h3>
          <div className={styles.formGrid}>
            <label className={styles.formLabel}>{t('htFieldStatus')}
              <select className={styles.input} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="inquiry">{t('htResInquiry')}</option>
                <option value="confirmed">{t('htResConfirmed')}</option>
                <option value="checked_in">{t('htResCheckedIn')}</option>
                <option value="checked_out">{t('htResCheckedOut')}</option>
                <option value="cancelled">{t('htResCancelled')}</option>
                <option value="no_show">{t('htResNoShow')}</option>
              </select>
            </label>
            <label className={styles.formLabel}>{t('htFieldSource')}
              <select className={styles.input} value={form.source} onChange={e => set('source', e.target.value)}>
                <option value="direct">{t('htSrcDirect')}</option>
                <option value="phone">{t('htSrcPhone')}</option>
                <option value="walk_in">{t('htSrcWalkIn')}</option>
                <option value="booking_com">{t('htSrcBookingCom')}</option>
                <option value="airbnb">{t('htSrcAirbnb')}</option>
                <option value="expedia">{t('htSrcExpedia')}</option>
              </select>
            </label>
            <label className={styles.formLabel}>{t('htPaymentStatus')}
              <select className={styles.input} value={form.payment_status} onChange={e => set('payment_status', e.target.value)}>
                <option value="pending">{t('htPayPending')}</option>
                <option value="partial">{t('htPayPartial')}</option>
                <option value="paid">{t('htPayPaid')}</option>
                <option value="refunded">{t('htPayRefunded')}</option>
              </select>
            </label>
          </div>
        </section>

        <section className={styles.formSection}>
          <h3 className={styles.sectionTitle}>{t('htNotes')}</h3>
          <div className={styles.formGrid}>
            <label className={styles.formLabel} style={{ gridColumn: '1/-1' }}>{t('htGuestRequests')}
              <textarea className={styles.textarea} value={form.special_requests} onChange={e => set('special_requests', e.target.value)} rows={2} placeholder="Posebni zahtjevi gosta..." />
            </label>
            <label className={styles.formLabel} style={{ gridColumn: '1/-1' }}>{t('htInternalNotes')}
              <textarea className={styles.textarea} value={form.internal_notes} onChange={e => set('internal_notes', e.target.value)} rows={2} placeholder="Interne napomene (vidljive samo osoblju)..." />
            </label>
          </div>
        </section>
      </div>
    </div>
  )
}
