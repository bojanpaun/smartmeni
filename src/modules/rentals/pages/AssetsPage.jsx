import { useState, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import { translateContent, rentalAssetFields } from '../../../lib/contentTranslate'
import { useAssets } from '../hooks/useAssets'
import ImageUpload from '../../../components/shared/ImageUpload'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'

const coverOf = (photoUrls) => (photoUrls || '').split('\n').map(s => s.trim()).find(s => s.startsWith('http')) || null
const RentalMap = lazy(() => import('../../../components/shared/RentalMap'))
import toast from 'react-hot-toast'
import styles from './AssetsPage.module.css'

const AMENITY_OPTIONS = ['WiFi', 'Klima', 'Bazen', 'Parking', 'Pogled na more', 'Kuhinja', 'Veš mašina', 'Terasa', 'Roštilj', 'TV', 'Sef']
const ACCESS_TYPES = ['keybox', 'smart_lock', 'licno']

const emptyForm = () => ({
  name: '', location_id: '', base_price: '', pricing_unit: 'night', cleaning_fee: '', min_duration: 1, status: 'active',
  max_guests: 2, bedrooms: 1, beds: 1, bathrooms: 1, amenities: [], access_type: 'keybox', description: '', photo_urls: '',
  address: '', latitude: null, longitude: null,
})

export default function AssetsPage() {
  const { restaurant } = usePlatform()
  const { t } = useTranslation('admin')
  const navigate = useNavigate()
  const { assets, locations, loading, refetch } = useAssets(restaurant?.id)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleAmenity = (a) => setForm(f => ({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter(x => x !== a) : [...f.amenities, a] }))

  const openNew = () => { setEditing(null); setForm(emptyForm()); setShowForm(true) }
  const openEdit = (a) => {
    const d = Array.isArray(a.details) ? a.details[0] : a.details
    setEditing(a)
    setForm({
      name: a.name, location_id: a.location_id || '', base_price: a.base_price ?? '', pricing_unit: a.pricing_unit || 'night',
      cleaning_fee: a.cleaning_fee ?? '', min_duration: a.min_duration ?? 1, status: a.status || 'active',
      max_guests: d?.max_guests ?? 2, bedrooms: d?.bedrooms ?? 1, beds: d?.beds ?? 1, bathrooms: d?.bathrooms ?? 1,
      amenities: d?.amenities ?? [], access_type: d?.access_type || 'keybox', description: d?.description ?? '', photo_urls: d?.photo_urls ?? '',
      address: a.address ?? '', latitude: a.latitude ?? null, longitude: a.longitude ?? null,
    })
    setShowForm(true)
  }

  const addLocation = async () => {
    const name = window.prompt(t('raLocationPrompt'))
    if (!name?.trim()) return
    const { data, error } = await supabase.from('rental_locations')
      .insert({ restaurant_id: restaurant.id, name: name.trim() }).select('id').single()
    if (error) return toast.error(t('raSaveErr'))
    await refetch()
    set('location_id', data.id)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error(t('raNameRequired'))
    setSaving(true)
    const core = {
      restaurant_id: restaurant.id, name: form.name.trim(), location_id: form.location_id || null,
      base_price: parseFloat(form.base_price) || null, pricing_unit: form.pricing_unit,
      cleaning_fee: parseFloat(form.cleaning_fee) || 0, min_duration: parseInt(form.min_duration) || 1, status: form.status,
      address: form.address.trim() || null, latitude: form.latitude, longitude: form.longitude,
    }
    const { data: asset, error } = editing
      ? await supabase.from('rental_assets').update(core).eq('id', editing.id).eq('restaurant_id', restaurant.id).select('id').single()
      : await supabase.from('rental_assets').insert(core).select('id').single()
    if (error || !asset) { setSaving(false); return toast.error(t('raSaveErr')) }

    const det = {
      asset_id: asset.id, max_guests: parseInt(form.max_guests) || null, bedrooms: parseInt(form.bedrooms) || null,
      beds: parseInt(form.beds) || null, bathrooms: parseInt(form.bathrooms) || null, amenities: form.amenities,
      access_type: form.access_type, description: form.description.trim() || null, photo_urls: form.photo_urls || null,
    }
    const { error: dErr } = await supabase.from('rental_accommodation_details').upsert(det, { onConflict: 'asset_id' })
    setSaving(false)
    if (dErr) return toast.error(t('raSaveErr'))

    toast.success(editing ? t('raUpdated') : t('raSaved'))
    setShowForm(false)
    refetch()
    // AI prevod naziva/opisa (fire-and-forget) — gost vidi na svom jeziku (RENT-0b).
    translateContent(restaurant.id, rentalAssetFields(asset.id, form.name, form.description)).catch(() => {})
  }

  const handleDelete = async (a) => {
    if (!window.confirm(t('raDeleteConfirm'))) return
    const { error } = await supabase.from('rental_assets').delete().eq('id', a.id).eq('restaurant_id', restaurant.id)
    if (error) return toast.error(t('raDeleteErr'))   // RESTRICT: ima rezervacije → arhiviraj
    toast.success(t('raDeleted'))
    refetch()
  }

  if (loading) return <LoadingSpinner fullPage />

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <button className={styles.btnBack} onClick={() => navigate('/admin/rental')}>← {t('modRental')}</button>
          <h1 className={styles.title}>{t('raTitle')}</h1>
          <p className={styles.subtitle}>{t('raSubtitle')}</p>
        </div>
        <button className={styles.btnPrimary} onClick={openNew}>+ {t('raNew')}</button>
      </div>

      {assets.length === 0 ? (
        <div className={styles.empty}>{t('raNone')}</div>
      ) : (
        <div className={styles.list}>
          {assets.map(a => {
            const d = Array.isArray(a.details) ? a.details[0] : a.details
            const cover = coverOf(d?.photo_urls)
            return (
              <div key={a.id} className={styles.card}>
                {cover
                  ? <img src={cover} alt={a.name} className={styles.cardThumb} loading="lazy" decoding="async" onError={e => { e.currentTarget.style.display = 'none' }} />
                  : <div className={styles.cardThumbPlaceholder}>🏠</div>}
                <div className={styles.cardMain}>
                  <div className={styles.cardName}>{a.name}</div>
                  <div className={styles.cardMeta}>
                    {a.location?.name && <span>📍 {a.location.name}</span>}
                    {a.base_price != null && <span>{t('raPerNight', { price: a.base_price })}</span>}
                    {d?.max_guests != null && <span>👥 {d.max_guests}</span>}
                  </div>
                </div>
                <div className={styles.cardRight}>
                  <span className={`${styles.badge} ${styles['st_' + a.status]}`}>{t('raStatus_' + a.status)}</span>
                  <button className={styles.iconBtn} onClick={() => openEdit(a)}>✏️</button>
                  <button className={styles.iconBtn} onClick={() => handleDelete(a)}>🗑️</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <div className={styles.overlay} onClick={() => setShowForm(false)}>
          <div className={styles.formCard} onClick={e => e.stopPropagation()}>
            <h3 className={styles.formTitle}>{editing ? t('raEdit') : t('raNew')}</h3>
            <div className={styles.grid}>
              <label className={styles.field} style={{ gridColumn: '1/-1' }}>{t('raName')} *
                <input className={styles.input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Vila Galeb, Studio Centar…" />
              </label>

              <label className={styles.field}>{t('raLocation')}
                <div className={styles.locRow}>
                  <select className={styles.input} value={form.location_id} onChange={e => set('location_id', e.target.value)}>
                    <option value="">{t('raNoLocation')}</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}{l.city ? `, ${l.city}` : ''}</option>)}
                  </select>
                  <button type="button" className={styles.btnSm} onClick={addLocation}>+ {t('raNewLocation')}</button>
                </div>
              </label>
              <label className={styles.field}>{t('raStatus')}
                <select className={styles.input} value={form.status} onChange={e => set('status', e.target.value)}>
                  {['active', 'inactive', 'archived'].map(s => <option key={s} value={s}>{t('raStatus_' + s)}</option>)}
                </select>
              </label>

              <label className={styles.field}>{t('raBasePrice')}
                <input className={styles.input} type="number" min={0} value={form.base_price} onChange={e => set('base_price', e.target.value)} placeholder="0.00" />
              </label>
              <label className={styles.field}>{t('raPricingUnit')}
                <select className={styles.input} value={form.pricing_unit} onChange={e => set('pricing_unit', e.target.value)}>
                  <option value="night">{t('raUnitNight')}</option>
                  <option value="day">{t('raUnitDay')}</option>
                </select>
              </label>
              <label className={styles.field}>{t('raCleaningFee')}
                <input className={styles.input} type="number" min={0} value={form.cleaning_fee} onChange={e => set('cleaning_fee', e.target.value)} placeholder="0.00" />
              </label>
              <label className={styles.field}>{t('raMinDuration')}
                <input className={styles.input} type="number" min={1} value={form.min_duration} onChange={e => set('min_duration', e.target.value)} />
              </label>

              <div className={styles.sep} />

              <label className={styles.field}>{t('raMaxGuests')}
                <input className={styles.input} type="number" min={1} value={form.max_guests} onChange={e => set('max_guests', e.target.value)} />
              </label>
              <label className={styles.field}>{t('raBedrooms')}
                <input className={styles.input} type="number" min={0} value={form.bedrooms} onChange={e => set('bedrooms', e.target.value)} />
              </label>
              <label className={styles.field}>{t('raBeds')}
                <input className={styles.input} type="number" min={0} value={form.beds} onChange={e => set('beds', e.target.value)} />
              </label>
              <label className={styles.field}>{t('raBathrooms')}
                <input className={styles.input} type="number" min={0} value={form.bathrooms} onChange={e => set('bathrooms', e.target.value)} />
              </label>

              <label className={styles.field}>{t('raAccessType')}
                <select className={styles.input} value={form.access_type} onChange={e => set('access_type', e.target.value)}>
                  {ACCESS_TYPES.map(a => <option key={a} value={a}>{t('raAccess_' + a)}</option>)}
                </select>
              </label>

              <label className={styles.field} style={{ gridColumn: '1/-1' }}>{t('raAmenities')}
                <div className={styles.chips}>
                  {AMENITY_OPTIONS.map(a => (
                    <button key={a} type="button"
                      className={`${styles.chip} ${form.amenities.includes(a) ? styles.chipOn : ''}`}
                      onClick={() => toggleAmenity(a)}>{a}</button>
                  ))}
                </div>
              </label>

              <label className={styles.field} style={{ gridColumn: '1/-1' }}>{t('raDescription')}
                <textarea className={`${styles.input} ${styles.textarea}`} rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder={t('raDescPlaceholder')} />
              </label>

              <div className={styles.field} style={{ gridColumn: '1/-1' }}>{t('raPhotos')}
                <ImageUpload multiple value={form.photo_urls} onChange={v => set('photo_urls', v)} restaurantId={restaurant?.id} />
                <span className={styles.hint}>{t('raPhotosHint')}</span>
              </div>

              <label className={styles.field} style={{ gridColumn: '1/-1' }}>{t('raAddress')}
                <input className={styles.input} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Njegoševa 4, 85310 Budva" />
              </label>
              <div className={styles.field} style={{ gridColumn: '1/-1' }}>{t('raPin')}
                <Suspense fallback={<div className={styles.hint}>…</div>}>
                  <RentalMap editable height={240}
                    value={form.latitude != null ? { lat: form.latitude, lng: form.longitude } : null}
                    onChange={({ lat, lng }) => setForm(f => ({ ...f, latitude: lat, longitude: lng }))} />
                </Suspense>
                <span className={styles.hint}>{form.latitude != null ? `📍 ${form.latitude}, ${form.longitude}` : t('raPinHint')}</span>
              </div>
            </div>

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
