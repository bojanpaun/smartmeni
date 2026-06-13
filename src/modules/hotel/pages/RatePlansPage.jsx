import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../../context/PlatformContext'
import { useRatePlans } from '../hooks/useRatePlans'
import { supabase } from '../../../lib/supabase'
import { translateContent, ratePlanFields } from '../../../lib/contentTranslate'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import styles from './Hotel.module.css'
import rp from './RatePlans.module.css'

const CANCEL_OPTIONS = [
  { value: 'flexible',       labelKey: 'rplCancelFlexible' },
  { value: 'moderate',       labelKey: 'rplCancelModerate' },
  { value: 'strict',         labelKey: 'rplCancelStrict' },
  { value: 'non_refundable', labelKey: 'rplCancelNone' },
]

const BLANK_PLAN = {
  plan_type: 'package',
  name: '',
  description: '',
  room_type_id: '',
  price_per_night: '',
  min_stay: 1,
  max_stay: '',
  cancellation_policy: 'flexible',
  advance_booking_days: '',
  payment_type: 'online',
  multiplier: '1.0',
  applies_from: '',
  applies_until: '',
  is_active: true,
  breakfast_included: false,
  selected_rooms: [],
}

export default function RatePlansPage() {
  const { restaurant } = usePlatform()
  const { t } = useTranslation('admin')
  const { ratePlans, loading, refetch } = useRatePlans(restaurant?.id)

  const [roomTypes, setRoomTypes] = useState([])
  const [allRooms, setAllRooms] = useState([])       // sve sobe hotela (za prikaz na kartici)
  const [roomsForType, setRoomsForType] = useState([]) // sobe za odabrani room_type u formi
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK_PLAN)
  const [saving, setSaving] = useState(false)
  const [expandedPlan, setExpandedPlan] = useState(null)
  const [seasonForm, setSeasonForm] = useState(null)

  // Učitaj tipove soba i sve sobe
  useEffect(() => {
    if (!restaurant?.id) return
    supabase
      .from('room_types')
      .select('id, name')
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setRoomTypes(data ?? []))
    supabase
      .from('rooms')
      .select('id, room_number, floor, room_type_id')
      .eq('restaurant_id', restaurant.id)
      .order('room_number')
      .then(({ data }) => setAllRooms(data ?? []))
  }, [restaurant?.id])

  // Učitaj sobe kad se promijeni room_type u formi
  useEffect(() => {
    if (!form.room_type_id || !restaurant?.id) { setRoomsForType([]); return }
    supabase
      .from('rooms')
      .select('id, room_number, floor')
      .eq('room_type_id', form.room_type_id)
      .eq('restaurant_id', restaurant.id)
      .order('room_number')
      .then(({ data }) => setRoomsForType(data ?? []))
  }, [form.room_type_id, restaurant?.id])

  const f = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const toggleRoom = (roomId) => {
    setForm(prev => ({
      ...prev,
      selected_rooms: prev.selected_rooms.includes(roomId)
        ? prev.selected_rooms.filter(id => id !== roomId)
        : [...prev.selected_rooms, roomId],
    }))
  }

  const openNew = () => { setEditing(null); setForm(BLANK_PLAN); setShowForm(true) }

  const openEdit = (plan) => {
    setEditing(plan)
    setForm({
      plan_type: plan.plan_type ?? 'package',
      name: plan.name ?? '',
      description: plan.description ?? '',
      room_type_id: plan.room_type_id ?? '',
      price_per_night: plan.price_per_night ?? '',
      min_stay: plan.min_stay ?? 1,
      max_stay: plan.max_stay ?? '',
      cancellation_policy: plan.cancellation_policy ?? 'flexible',
      advance_booking_days: plan.advance_booking_days ?? '',
      multiplier: plan.multiplier ?? '1.0',
      applies_from: plan.applies_from ?? '',
      applies_until: plan.applies_until ?? '',
      is_active: plan.is_active,
      breakfast_included: plan.breakfast_included ?? false,
      payment_type: plan.payment_type ?? 'online',
      selected_rooms: plan.rate_plan_rooms?.map(r => r.room_id) ?? [],
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error(t('htNameRequired'))
    if (form.plan_type === 'package') {
      if (!form.room_type_id) return toast.error(t('rplSelectRoomTypeErr'))
      if (!form.price_per_night) return toast.error(t('rplPriceRequired'))
    }
    if (form.plan_type === 'seasonal') {
      if (!form.multiplier || isNaN(parseFloat(form.multiplier))) return toast.error(t('rplMultiplierRequired'))
      const { data: existing } = await supabase
        .from('rate_plans')
        .select('id, name, applies_from, applies_until')
        .eq('restaurant_id', restaurant.id)
        .eq('plan_type', 'seasonal')
        .eq('is_active', true)
      const others = (existing ?? []).filter(p => p.id !== editing?.id)
      const nf = form.applies_from || null
      const nu = form.applies_until || null
      const conflict = others.find(p => {
        const ef = p.applies_from, eu = p.applies_until
        return (eu === null || nf === null || nf <= eu) &&
               (nu === null || ef === null || ef <= nu)
      })
      if (conflict) toast(t('rplOverlapWarn', { name: conflict.name }), { icon: '⚠️', duration: 5000 })
    }

    setSaving(true)
    const base = {
      restaurant_id: restaurant.id,
      plan_type: form.plan_type,
      name: form.name.trim(),
      description: form.description.trim() || null,
      is_active: form.is_active,
    }
    const payload = form.plan_type === 'package'
      ? {
          ...base,
          room_type_id: form.room_type_id || null,
          price_per_night: parseFloat(form.price_per_night),
          min_stay: parseInt(form.min_stay) || 1,
          max_stay: form.max_stay ? parseInt(form.max_stay) : null,
          cancellation_policy: form.cancellation_policy,
          advance_booking_days: form.advance_booking_days ? parseInt(form.advance_booking_days) : null,
          payment_type: form.payment_type,
          breakfast_included: form.breakfast_included,
          multiplier: 1.0,
          applies_from: null,
          applies_until: null,
        }
      : {
          ...base,
          room_type_id: null,
          price_per_night: null,
          min_stay: 1,
          max_stay: null,
          cancellation_policy: 'flexible',
          advance_booking_days: null,
          multiplier: parseFloat(form.multiplier),
          applies_from: form.applies_from || null,
          applies_until: form.applies_until || null,
        }

    let planId, saveError
    if (editing) {
      const res = await supabase.from('rate_plans').update(payload).eq('id', editing.id)
      saveError = res.error
      planId = editing.id
    } else {
      const res = await supabase.from('rate_plans').insert(payload).select('id').single()
      saveError = res.error
      planId = res.data?.id
    }

    setSaving(false)
    if (saveError) return toast.error(saveError.message ?? t('htSaveErr'))

    // Sinhronizuj rate_plan_rooms (samo za package planove)
    if (form.plan_type === 'package' && planId) {
      await supabase.from('rate_plan_rooms').delete().eq('rate_plan_id', planId)
      if (form.selected_rooms.length > 0) {
        await supabase.from('rate_plan_rooms').insert(
          form.selected_rooms.map(roomId => ({ rate_plan_id: planId, room_id: roomId }))
        )
      }
    }

    toast.success(editing ? t('rplPlanUpdated') : t('rplPlanAdded'))
    setShowForm(false)
    refetch()
    // AI prevod naziva/opisa PAKETA (fire-and-forget) — gost vidi paket na svom jeziku
    // u booking flow-u. Sezonski planovi (cjenovno pravilo) se ne prikazuju gostu.
    if (form.plan_type === 'package' && planId) {
      translateContent(restaurant.id, ratePlanFields({ id: planId, name: payload.name, description: payload.description })).catch(() => {})
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm(t('rplDeletePlanConfirm'))) return
    const { error } = await supabase.from('rate_plans').delete().eq('id', id)
    if (error) return toast.error(t('htDeleteErr'))
    toast.success(t('rplPlanDeleted'))
    refetch()
  }

  const openNewSeason = (planId) => setSeasonForm({ planId, data: { label: '', start_date: '', end_date: '', price_per_night: '' }, editing: null })
  const openEditSeason = (planId, s) => setSeasonForm({
    planId,
    data: { label: s.label ?? '', start_date: s.start_date, end_date: s.end_date, price_per_night: s.price_per_night },
    editing: s.id,
  })

  const handleSaveSeason = async () => {
    const { planId, data, editing: sid } = seasonForm
    if (!data.start_date || !data.end_date || !data.price_per_night) return toast.error(t('rplSeasonRequired'))
    const payload = { ...data, price_per_night: parseFloat(data.price_per_night), rate_plan_id: planId, restaurant_id: restaurant.id }
    const { error } = sid
      ? await supabase.from('seasonal_rates').update(payload).eq('id', sid)
      : await supabase.from('seasonal_rates').insert(payload)
    if (error) return toast.error(t('htSaveErr'))
    toast.success(sid ? t('rplSeasonUpdated') : t('rplSeasonAdded'))
    setSeasonForm(null)
    refetch()
  }

  const handleDeleteSeason = async (id) => {
    if (!window.confirm(t('rplDeleteSeasonConfirm'))) return
    await supabase.from('seasonal_rates').delete().eq('id', id)
    toast.success(t('rplSeasonDeleted'))
    refetch()
  }

  const packages  = ratePlans.filter(p => p.plan_type === 'package'  || !p.plan_type)
  const seasonals = ratePlans.filter(p => p.plan_type === 'seasonal')

  if (loading) return <LoadingSpinner fullPage />

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('rplTitle')}</h1>
          <p className={styles.subtitle}>{t('rplSubtitle')}</p>
        </div>
        <button className={styles.btnPrimary} onClick={openNew}>+ {t('rplNewPlan')}</button>
      </div>

      {/* ── FORM ── */}
      {showForm && (
        <div className={rp.formPanel}>
          <div className={rp.formHeader}>
            <span className={rp.formTitle}>{editing ? t('rplEditPlan', { name: editing.name }) : t('rplNewPlan')}</span>
            <button className={rp.formClose} onClick={() => setShowForm(false)}>✕</button>
          </div>

          {/* Plan type toggle */}
          <div className={rp.typeToggle}>
            <button
              className={`${rp.typeBtn} ${form.plan_type === 'package' ? rp.typeBtnActive : ''}`}
              onClick={() => f('plan_type', 'package')}
              type="button"
            >
              {t('rplTypePackage')}
            </button>
            <button
              className={`${rp.typeBtn} ${form.plan_type === 'seasonal' ? rp.typeBtnActive : ''}`}
              onClick={() => f('plan_type', 'seasonal')}
              type="button"
            >
              {t('rplTypeSeasonal')}
            </button>
          </div>

          {form.plan_type === 'seasonal' && (
            <p className={rp.typeHint}>
              {t('rplSeasonalHint')}
            </p>
          )}

          <div className={rp.formGrid}>
            <div className={rp.field}>
              <label>{t('htFieldName')}</label>
              <input value={form.name} onChange={e => f('name', e.target.value)}
                placeholder={form.plan_type === 'package' ? 'npr. Sa doručkom' : 'npr. Ljetna sezona'} />
            </div>
            <div className={rp.field}>
              <label>{t('rplDescOptional')}</label>
              <input value={form.description} onChange={e => f('description', e.target.value)} />
            </div>

            {/* Package fields */}
            {form.plan_type === 'package' && (<>
              <div className={rp.field}>
                <label>{t('htRoomTypeShort')} *</label>
                <select value={form.room_type_id} onChange={e => { f('room_type_id', e.target.value); f('selected_rooms', []) }}>
                  <option value="">{t('rplSelectRoomType')}</option>
                  {roomTypes.map(rt => (
                    <option key={rt.id} value={rt.id}>{rt.name}</option>
                  ))}
                </select>
              </div>
              <div className={rp.field}>
                <label>{t('htFieldPricePerNight')} *</label>
                <input type="number" min="0" step="0.01" value={form.price_per_night}
                  onChange={e => f('price_per_night', e.target.value)} placeholder="0.00" />
              </div>

              {/* Specifične sobe (opciono) */}
              {form.room_type_id && roomsForType.length > 0 && (
                <div className={rp.fieldFull}>
                  <label>
                    {t('rplLimitRooms')}
                    <span className={rp.labelOptional}> {t('rplOptional')}</span>
                  </label>
                  <p className={rp.fieldHint}>
                    {t('rplLimitRoomsHint')}
                  </p>
                  <div className={rp.roomCheckboxes}>
                    {roomsForType.map(room => (
                      <label
                        key={room.id}
                        className={`${rp.roomCheckbox} ${form.selected_rooms.includes(room.id) ? rp.roomCheckboxActive : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={form.selected_rooms.includes(room.id)}
                          onChange={() => toggleRoom(room.id)}
                        />
                        <span>{t('htRoomNum', { num: room.room_number })}{room.floor ? t('rplFloorSuffix', { n: room.floor }) : ''}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className={rp.field}>
                <label>{t('rplMinStay')}</label>
                <input type="number" min="1" value={form.min_stay} onChange={e => f('min_stay', e.target.value)} />
              </div>
              <div className={rp.field}>
                <label>{t('rplMaxStay')}</label>
                <input type="number" min="1" value={form.max_stay} onChange={e => f('max_stay', e.target.value)} placeholder={t('rplUnlimited')} />
              </div>
              <div className={rp.field}>
                <label>{t('rplCancelPolicy')}</label>
                <select value={form.cancellation_policy} onChange={e => f('cancellation_policy', e.target.value)}>
                  {CANCEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
                </select>
              </div>
              <div className={rp.field}>
                <label>{t('rplPaymentMethod')}</label>
                <select value={form.payment_type} onChange={e => f('payment_type', e.target.value)}>
                  <option value="online">{t('rplPayOnline')}</option>
                  <option value="on_arrival">{t('rplPayOnArrival')}</option>
                </select>
              </div>
              <div className={rp.field}>
                <label>{t('rplAdvanceDays')}</label>
                <input type="number" min="0" value={form.advance_booking_days}
                  onChange={e => f('advance_booking_days', e.target.value)} placeholder="0 = odmah" />
              </div>
              <div className={rp.field} style={{ gridColumn: '1 / -1' }}>
                <label className={rp.toggleRow} style={{ marginTop: 4 }}>
                  <span className={`${rp.toggle} ${form.breakfast_included ? rp.toggleOn : rp.toggleOff}`}
                    onClick={() => f('breakfast_included', !form.breakfast_included)} />
                  <span>🍳 {t('rplBreakfastIncluded')}</span>
                </label>
              </div>
            </>)}

            {/* Seasonal fields */}
            {form.plan_type === 'seasonal' && (<>
              <div className={rp.field}>
                <label>{t('rplMultiplier')}</label>
                <input type="number" min="0.1" max="10" step="0.01" value={form.multiplier}
                  onChange={e => f('multiplier', e.target.value)} placeholder="1.30" />
              </div>
              <div className={rp.field} />
              <div className={rp.field}>
                <label>{t('rplAppliesFrom')}</label>
                <input type="date" value={form.applies_from} onChange={e => f('applies_from', e.target.value)} />
              </div>
              <div className={rp.field}>
                <label>{t('rplAppliesUntil')}</label>
                <input type="date" value={form.applies_until} onChange={e => f('applies_until', e.target.value)} />
              </div>
            </>)}
          </div>

          <label className={rp.toggleRow}>
            <span className={`${rp.toggle} ${form.is_active ? rp.toggleOn : rp.toggleOff}`}
              onClick={() => f('is_active', !form.is_active)} />
            <span>{t('rplPlanActive')}</span>
          </label>

          <div className={rp.formActions}>
            <button className={styles.btnSecondary} onClick={() => setShowForm(false)}>{t('cancel')}</button>
            <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </div>
      )}

      {/* ── PACKAGES section ── */}
      <div className={rp.sectionHeader}>
        <span className={rp.sectionTitle}>{t('rplPackages')}</span>
        <span className={rp.sectionHint}>{t('rplPackagesHint')}</span>
      </div>

      {packages.length === 0 && !showForm ? (
        <div className={rp.empty}>
          <div className={rp.emptyIcon}>🏷️</div>
          <p>{t('rplNoPackages')}</p>
        </div>
      ) : (
        <div className={rp.planList}>
          {packages.map(plan => {
            const rtName = roomTypes.find(r => r.id === plan.room_type_id)?.name
            const linkedRooms = plan.rate_plan_rooms?.length > 0
              ? plan.rate_plan_rooms.map(r => allRooms.find(rm => rm.id === r.room_id)?.room_number ?? '?').join(', ')
              : null
            return (
              <div key={plan.id} className={rp.planCard}>
                <div className={rp.planCardHeader}>
                  <div className={rp.planInfo}>
                    <div className={rp.planName}>
                      {plan.name}
                      {!plan.room_type_id && <span className={rp.badgeWarn}>{t('rplNotLinkedRoom')}</span>}
                      {!plan.is_active && <span className={rp.badge}>{t('psInactive')}</span>}
                    </div>
                    {plan.description && <div className={rp.planDesc}>{plan.description}</div>}
                    <div className={rp.planMeta}>
                      {rtName && <span className={rp.planRoomType}>{rtName}</span>}
                      {linkedRooms && (
                        <span className={rp.planRooms}>{t('rplRoomsList', { rooms: linkedRooms })}</span>
                      )}
                      <span className={rp.planPrice}>{t('htPerNight', { price: Number(plan.price_per_night).toFixed(2) })}</span>
                      <span className={rp.planDot}>·</span>
                      <span>{plan.min_stay === 1 ? t('rplMinNight', { n: plan.min_stay }) : t('rplMinNights', { n: plan.min_stay })}</span>
                      <span className={rp.planDot}>·</span>
                      <span>{(() => { const o = CANCEL_OPTIONS.find(o => o.value === plan.cancellation_policy); return o ? t(o.labelKey).split('—')[0].trim() : '' })()}</span>
                    </div>
                  </div>
                  <div className={rp.planActions}>
                    <button className={rp.btnEdit} onClick={() => openEdit(plan)}>{t('htEdit')}</button>
                    <button className={rp.btnExpand} onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}>
                      {expandedPlan === plan.id ? t('rplClose') : t('rplSeasons', { n: plan.seasonal_rates?.length ?? 0 })}
                    </button>
                    <button className={rp.btnDelete} onClick={() => handleDelete(plan.id)}>{t('htDelete')}</button>
                  </div>
                </div>

                {expandedPlan === plan.id && (
                  <div className={rp.seasonSection}>
                    <div className={rp.seasonHeader}>
                      <span className={rp.seasonTitle}>{t('rplSeasonalPrices')}</span>
                      <button className={rp.btnAddSeason} onClick={() => openNewSeason(plan.id)}>+ {t('rplAddShort')}</button>
                    </div>
                    {seasonForm?.planId === plan.id && (
                      <div className={rp.seasonForm}>
                        <div className={rp.seasonFormGrid}>
                          <div className={rp.field}><label>{t('htFieldName')}</label>
                            <input value={seasonForm.data.label} onChange={e => setSeasonForm(f => ({ ...f, data: { ...f.data, label: e.target.value } }))} placeholder="Ljetna sezona" /></div>
                          <div className={rp.field}><label>{t('rplPriceNight')}</label>
                            <input type="number" min="0" step="0.01" value={seasonForm.data.price_per_night} onChange={e => setSeasonForm(f => ({ ...f, data: { ...f.data, price_per_night: e.target.value } }))} /></div>
                          <div className={rp.field}><label>{t('rplFrom')}</label>
                            <input type="date" value={seasonForm.data.start_date} onChange={e => setSeasonForm(f => ({ ...f, data: { ...f.data, start_date: e.target.value } }))} /></div>
                          <div className={rp.field}><label>{t('rplTo')}</label>
                            <input type="date" value={seasonForm.data.end_date} onChange={e => setSeasonForm(f => ({ ...f, data: { ...f.data, end_date: e.target.value } }))} /></div>
                        </div>
                        <div className={rp.seasonFormActions}>
                          <button className={styles.btnSecondary} onClick={() => setSeasonForm(null)}>{t('cancel')}</button>
                          <button className={styles.btnPrimary} onClick={handleSaveSeason}>{t('save')}</button>
                        </div>
                      </div>
                    )}
                    {plan.seasonal_rates?.length === 0 && !seasonForm && (
                      <p className={rp.seasonEmpty}>{t('rplNoSeasonOverrides')}</p>
                    )}
                    {plan.seasonal_rates?.map(s => (
                      <div key={s.id} className={rp.seasonRow}>
                        <div className={rp.seasonRowInfo}>
                          <span className={rp.seasonRowLabel}>{s.label || t('rplSeason')}</span>
                          <span className={rp.seasonRowDates}>{s.start_date} — {s.end_date}</span>
                        </div>
                        <span className={rp.seasonRowPrice}>{t('htPerNight', { price: Number(s.price_per_night).toFixed(2) })}</span>
                        <div className={rp.seasonRowActions}>
                          <button className={rp.btnEdit} onClick={() => openEditSeason(plan.id, s)}>{t('htEdit')}</button>
                          <button className={rp.btnDelete} onClick={() => handleDeleteSeason(s.id)}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── SEASONAL MULTIPLIERS section ── */}
      <div className={rp.sectionHeader} style={{ marginTop: 32 }}>
        <span className={rp.sectionTitle}>{t('rplSeasonalMultipliers')}</span>
        <span className={rp.sectionHint}>{t('rplSeasonalMultHint')}</span>
      </div>

      {seasonals.length === 0 ? (
        <div className={rp.empty}>
          <div className={rp.emptyIcon}>📅</div>
          <p>{t('rplNoSeasonalMult')}</p>
        </div>
      ) : (
        <div className={rp.planList}>
          {seasonals.map(plan => (
            <div key={plan.id} className={rp.planCard}>
              <div className={rp.planCardHeader}>
                <div className={rp.planInfo}>
                  <div className={rp.planName}>
                    {plan.name}
                    {!plan.is_active && <span className={rp.badge}>{t('psInactive')}</span>}
                  </div>
                  {plan.description && <div className={rp.planDesc}>{plan.description}</div>}
                  <div className={rp.planMeta}>
                    <span className={`${rp.planPrice} ${plan.multiplier > 1 ? rp.multUp : rp.multDown}`}>
                      ×{Number(plan.multiplier).toFixed(2)}
                      {plan.multiplier > 1
                        ? ` (+${((plan.multiplier - 1) * 100).toFixed(0)}%)`
                        : ` (-${((1 - plan.multiplier) * 100).toFixed(0)}%)`}
                    </span>
                    {(plan.applies_from || plan.applies_until) && (
                      <>
                        <span className={rp.planDot}>·</span>
                        <span>{plan.applies_from ?? '∞'} — {plan.applies_until ?? '∞'}</span>
                      </>
                    )}
                    {!plan.applies_from && !plan.applies_until && (
                      <><span className={rp.planDot}>·</span><span>{t('rplAlwaysActive')}</span></>
                    )}
                  </div>
                </div>
                <div className={rp.planActions}>
                  <button className={rp.btnEdit} onClick={() => openEdit(plan)}>{t('htEdit')}</button>
                  <button className={rp.btnDelete} onClick={() => handleDelete(plan.id)}>{t('htDelete')}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
