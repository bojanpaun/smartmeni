import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import { useAssets } from '../hooks/useAssets'
import { useBookings } from '../hooks/useBookings'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import styles from './BookingsPage.module.css'

const STATUSES = ['confirmed', 'checked_in', 'checked_out', 'cancelled']
const SOURCE_LABEL = { direct: null, booking: 'Booking.com', airbnb: 'Airbnb', vrbo: 'Vrbo' }

const emptyForm = () => ({
  asset_id: '', start_date: '', end_date: '', adults: 2, children: 0,
  guest_name: '', guest_email: '', guest_phone: '', source: 'direct',
})

export default function BookingsPage() {
  const { restaurant } = usePlatform()
  const { t } = useTranslation('admin')
  const navigate = useNavigate()
  const { assets } = useAssets(restaurant?.id)
  const { bookings, loading, refetch } = useBookings(restaurant?.id)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [quote, setQuote] = useState(null)
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Živi obračun cijene (server-side RPC — jedan izvor istine).
  useEffect(() => {
    const { asset_id, start_date, end_date, adults, children } = form
    if (!asset_id || !start_date || !end_date || end_date <= start_date) { setQuote(null); return }
    let cancelled = false
    supabase.rpc('rental_quote_price', {
      p_asset_id: asset_id, p_start: start_date, p_end: end_date,
      p_adults: parseInt(adults) || 0, p_children: parseInt(children) || 0,
    }).then(({ data, error }) => { if (!cancelled && !error) setQuote(data) })
    return () => { cancelled = true }
  }, [form.asset_id, form.start_date, form.end_date, form.adults, form.children])

  const openNew = () => { setForm(emptyForm()); setQuote(null); setShowForm(true) }

  const handleSave = async () => {
    if (!form.asset_id || !form.start_date || !form.end_date) return toast.error(t('rbPeriodRequired'))
    if (form.end_date <= form.start_date) return toast.error(t('rbPeriodRequired'))
    if (!form.guest_name.trim()) return toast.error(t('rbNameRequired'))
    setSaving(true)
    const { data: bk, error } = await supabase.from('rental_bookings').insert({
      restaurant_id: restaurant.id, asset_id: form.asset_id,
      start_date: form.start_date, end_date: form.end_date,
      guest_name: form.guest_name.trim(), guest_email: form.guest_email.trim() || null, guest_phone: form.guest_phone.trim() || null,
      source: form.source,
      base_total: quote?.base_total ?? null, cleaning_fee: quote?.cleaning_fee ?? 0, total_amount: quote?.total_amount ?? null,
    }).select('id').single()
    if (error || !bk) {
      setSaving(false)
      return toast.error(error?.code === '23P01' ? t('rbOverlap') : t('rbSaveErr'))
    }
    // Boravak (adults/children/taksa) — satelitska tabela za smještaj.
    await supabase.from('rental_accommodation_stays').insert({
      booking_id: bk.id, adults: parseInt(form.adults) || 1, children: parseInt(form.children) || 0,
      tourist_tax: quote?.tourist_tax ?? 0,
    })
    setSaving(false)
    toast.success(t('rbSaved'))
    setShowForm(false)
    refetch()
    // Email potvrda gostu (fire-and-forget) — samo ako je unesen email.
    if (form.guest_email.trim()) {
      supabase.functions.invoke('send-rental-email', { body: { booking_id: bk.id } }).catch(() => {})
    }
  }

  const changeStatus = async (id, status) => {
    await supabase.from('rental_bookings').update({ status }).eq('id', id).eq('restaurant_id', restaurant.id)
    // realtime osvježava listu
  }

  if (loading) return <LoadingSpinner fullPage />

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <button className={styles.btnBack} onClick={() => navigate('/admin/rental')}>← {t('modRental')}</button>
          <h1 className={styles.title}>{t('rbTitle')}</h1>
          <p className={styles.subtitle}>{t('rbSubtitle')}</p>
        </div>
        <button className={styles.btnPrimary} onClick={openNew} disabled={assets.length === 0}>+ {t('rbNew')}</button>
      </div>

      {assets.length === 0 ? (
        <div className={styles.empty}>{t('rpNoAssets')}</div>
      ) : bookings.length === 0 ? (
        <div className={styles.empty}>{t('rbNone')}</div>
      ) : (
        <div className={styles.list}>
          {bookings.map(b => (
            <div key={b.id} className={`${styles.card} ${b.status === 'cancelled' ? styles.cardCancelled : ''}`}>
              <div className={styles.cardMain}>
                <div className={styles.cardName}>{b.guest_name}</div>
                <div className={styles.cardMeta}>
                  <span>🏠 {b.asset?.name}</span>
                  <span>{b.start_date} → {b.end_date}</span>
                  {b.total_amount != null && <span>{b.total_amount} €</span>}
                  {SOURCE_LABEL[b.source] && <span className={styles.src}>{SOURCE_LABEL[b.source]}</span>}
                </div>
              </div>
              <select className={styles.statusSelect} value={b.status} onChange={e => changeStatus(b.id, e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{t('rbStatus_' + s)}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className={styles.overlay} onClick={() => setShowForm(false)}>
          <div className={styles.formCard} onClick={e => e.stopPropagation()}>
            <h3 className={styles.formTitle}>{t('rbNew')}</h3>
            <div className={styles.grid}>
              <label className={styles.field} style={{ gridColumn: '1/-1' }}>{t('rbAsset')} *
                <select className={styles.input} value={form.asset_id} onChange={e => set('asset_id', e.target.value)}>
                  <option value="">—</option>
                  {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
              <label className={styles.field}>{t('rbStart')} *
                <input className={styles.input} type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
              </label>
              <label className={styles.field}>{t('rbEnd')} *
                <input className={styles.input} type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
              </label>
              <label className={styles.field}>{t('rbAdults')}
                <input className={styles.input} type="number" min={1} value={form.adults} onChange={e => set('adults', e.target.value)} />
              </label>
              <label className={styles.field}>{t('rbChildren')}
                <input className={styles.input} type="number" min={0} value={form.children} onChange={e => set('children', e.target.value)} />
              </label>
              <label className={styles.field} style={{ gridColumn: '1/-1' }}>{t('rbGuestName')} *
                <input className={styles.input} value={form.guest_name} onChange={e => set('guest_name', e.target.value)} />
              </label>
              <label className={styles.field}>{t('rbGuestEmail')}
                <input className={styles.input} type="email" value={form.guest_email} onChange={e => set('guest_email', e.target.value)} />
              </label>
              <label className={styles.field}>{t('rbGuestPhone')}
                <input className={styles.input} value={form.guest_phone} onChange={e => set('guest_phone', e.target.value)} />
              </label>
              <label className={styles.field}>{t('rbSource')}
                <select className={styles.input} value={form.source} onChange={e => set('source', e.target.value)}>
                  <option value="direct">{t('rbSourceDirect')}</option>
                  <option value="booking">Booking.com</option>
                  <option value="airbnb">Airbnb</option>
                  <option value="vrbo">Vrbo</option>
                </select>
              </label>
            </div>

            {quote && (
              <div className={styles.quote}>
                <div className={styles.quoteRow}><span>{t('rbQuoteNights')}</span><span>{quote.nights}</span></div>
                <div className={styles.quoteRow}><span>{t('rbQuoteBase')}</span><span>{quote.base_total} €</span></div>
                <div className={styles.quoteRow}><span>{t('rbQuoteCleaning')}</span><span>{quote.cleaning_fee} €</span></div>
                <div className={styles.quoteRow}><span>{t('rbQuoteTax')}</span><span>{quote.tourist_tax} €</span></div>
                <div className={`${styles.quoteRow} ${styles.quoteTotal}`}><span>{t('rbQuoteTotal')}</span><span>{quote.total_amount} €</span></div>
              </div>
            )}

            <div className={styles.formActions}>
              <button className={styles.btnSecondary} onClick={() => setShowForm(false)}>{t('cancel')}</button>
              <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>{saving ? t('saving') : t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
