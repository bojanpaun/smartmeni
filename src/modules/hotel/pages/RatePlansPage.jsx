import { useState, useEffect } from 'react'
import { usePlatform } from '../../../context/PlatformContext'
import { useRatePlans } from '../hooks/useRatePlans'
import { supabase } from '../../../lib/supabase'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import styles from './Hotel.module.css'
import rp from './RatePlans.module.css'

const CANCEL_OPTIONS = [
  { value: 'flexible',       label: 'Fleksibilna — besplatno do 24h' },
  { value: 'moderate',       label: 'Umjerena — besplatno do 5 dana' },
  { value: 'strict',         label: 'Stroga — 50% refund do 7 dana' },
  { value: 'non_refundable', label: 'Bez povrata' },
]

const BLANK_PLAN = {
  plan_type: 'package',
  name: '',
  description: '',
  // package fields
  room_type_id: '',
  price_per_night: '',
  min_stay: 1,
  max_stay: '',
  cancellation_policy: 'flexible',
  advance_booking_days: '',
  payment_type: 'online',
  // seasonal fields
  multiplier: '1.0',
  applies_from: '',
  applies_until: '',
  is_active: true,
}

export default function RatePlansPage() {
  const { restaurant } = usePlatform()
  const { ratePlans, loading, refetch } = useRatePlans(restaurant?.id)

  const [roomTypes, setRoomTypes] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK_PLAN)
  const [saving, setSaving] = useState(false)
  const [expandedPlan, setExpandedPlan] = useState(null)
  const [seasonForm, setSeasonForm] = useState(null)

  useEffect(() => {
    if (!restaurant?.id) return
    supabase
      .from('room_types')
      .select('id, name')
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setRoomTypes(data ?? []))
  }, [restaurant?.id])

  const f = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

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
      payment_type: plan.payment_type ?? 'online',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Naziv je obavezan')
    if (form.plan_type === 'package') {
      if (!form.room_type_id) return toast.error('Odaberite tip sobe')
      if (!form.price_per_night) return toast.error('Cijena je obavezna')
    }
    if (form.plan_type === 'seasonal') {
      if (!form.multiplier || isNaN(parseFloat(form.multiplier))) return toast.error('Multiplikator je obavezan')

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
      if (conflict) toast(`Upozorenje: Preklapanje sa "${conflict.name}". Primjenjivaće se viši multiplikator.`, { icon: '⚠️', duration: 5000 })
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

    const { error } = editing
      ? await supabase.from('rate_plans').update(payload).eq('id', editing.id)
      : await supabase.from('rate_plans').insert(payload)
    setSaving(false)
    if (error) return toast.error(error.message ?? 'Greška pri čuvanju')
    toast.success(editing ? 'Plan ažuriran' : 'Plan dodan')
    setShowForm(false)
    refetch()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Obrisati ovaj plan?')) return
    const { error } = await supabase.from('rate_plans').delete().eq('id', id)
    if (error) return toast.error('Greška pri brisanju')
    toast.success('Plan obrisan')
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
    if (!data.start_date || !data.end_date || !data.price_per_night) return toast.error('Datum i cijena su obavezni')
    const payload = { ...data, price_per_night: parseFloat(data.price_per_night), rate_plan_id: planId, restaurant_id: restaurant.id }
    const { error } = sid
      ? await supabase.from('seasonal_rates').update(payload).eq('id', sid)
      : await supabase.from('seasonal_rates').insert(payload)
    if (error) return toast.error('Greška pri čuvanju')
    toast.success(sid ? 'Sezona ažurirana' : 'Sezona dodana')
    setSeasonForm(null)
    refetch()
  }

  const handleDeleteSeason = async (id) => {
    if (!window.confirm('Obrisati ovu sezonu?')) return
    await supabase.from('seasonal_rates').delete().eq('id', id)
    toast.success('Sezona obrisana')
    refetch()
  }

  const packages  = ratePlans.filter(p => p.plan_type === 'package'  || !p.plan_type)
  const seasonals = ratePlans.filter(p => p.plan_type === 'seasonal')

  if (loading) return <LoadingSpinner fullPage />

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Cjenovni planovi</h1>
          <p className={styles.subtitle}>Paketi po tipu sobe i sezonski multiplikatori</p>
        </div>
        <button className={styles.btnPrimary} onClick={openNew}>+ Novi plan</button>
      </div>

      {/* ── FORM ── */}
      {showForm && (
        <div className={rp.formPanel}>
          <div className={rp.formHeader}>
            <span className={rp.formTitle}>{editing ? `Uredi: ${editing.name}` : 'Novi plan'}</span>
            <button className={rp.formClose} onClick={() => setShowForm(false)}>✕</button>
          </div>

          {/* Plan type toggle */}
          <div className={rp.typeToggle}>
            <button
              className={`${rp.typeBtn} ${form.plan_type === 'package' ? rp.typeBtnActive : ''}`}
              onClick={() => f('plan_type', 'package')}
              type="button"
            >
              Paket (fiksna cijena)
            </button>
            <button
              className={`${rp.typeBtn} ${form.plan_type === 'seasonal' ? rp.typeBtnActive : ''}`}
              onClick={() => f('plan_type', 'seasonal')}
              type="button"
            >
              Sezonski multiplikator
            </button>
          </div>

          {form.plan_type === 'seasonal' && (
            <p className={rp.typeHint}>
              Multiplikator 1.3 = sve cijene +30% za odabrani period. Primjenjuje se na base_price i sve pakete.
            </p>
          )}

          <div className={rp.formGrid}>
            <div className={rp.field}>
              <label>Naziv</label>
              <input value={form.name} onChange={e => f('name', e.target.value)}
                placeholder={form.plan_type === 'package' ? 'npr. Sa doručkom' : 'npr. Ljetna sezona'} />
            </div>
            <div className={rp.field}>
              <label>Opis (opciono)</label>
              <input value={form.description} onChange={e => f('description', e.target.value)} />
            </div>

            {/* Package fields */}
            {form.plan_type === 'package' && (<>
              <div className={rp.field}>
                <label>Tip sobe *</label>
                <select value={form.room_type_id} onChange={e => f('room_type_id', e.target.value)}>
                  <option value="">— Odaberi tip sobe —</option>
                  {roomTypes.map(rt => (
                    <option key={rt.id} value={rt.id}>{rt.name}</option>
                  ))}
                </select>
              </div>
              <div className={rp.field}>
                <label>Cijena po noći (€) *</label>
                <input type="number" min="0" step="0.01" value={form.price_per_night}
                  onChange={e => f('price_per_night', e.target.value)} placeholder="0.00" />
              </div>
              <div className={rp.field}>
                <label>Min. boravak (noći)</label>
                <input type="number" min="1" value={form.min_stay} onChange={e => f('min_stay', e.target.value)} />
              </div>
              <div className={rp.field}>
                <label>Max. boravak (opciono)</label>
                <input type="number" min="1" value={form.max_stay} onChange={e => f('max_stay', e.target.value)} placeholder="Neograničeno" />
              </div>
              <div className={rp.field}>
                <label>Politika otkazivanja</label>
                <select value={form.cancellation_policy} onChange={e => f('cancellation_policy', e.target.value)}>
                  {CANCEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className={rp.field}>
                <label>Način plaćanja</label>
                <select value={form.payment_type} onChange={e => f('payment_type', e.target.value)}>
                  <option value="online">Online (PayPal)</option>
                  <option value="on_arrival">Na recepciji</option>
                </select>
              </div>
              <div className={rp.field}>
                <label>Min. dana unaprijed (opciono)</label>
                <input type="number" min="0" value={form.advance_booking_days}
                  onChange={e => f('advance_booking_days', e.target.value)} placeholder="0 = odmah" />
              </div>
            </>)}

            {/* Seasonal fields */}
            {form.plan_type === 'seasonal' && (<>
              <div className={rp.field}>
                <label>Multiplikator *</label>
                <input type="number" min="0.1" max="10" step="0.01" value={form.multiplier}
                  onChange={e => f('multiplier', e.target.value)} placeholder="1.30" />
              </div>
              <div className={rp.field} />
              <div className={rp.field}>
                <label>Važi od (opciono)</label>
                <input type="date" value={form.applies_from} onChange={e => f('applies_from', e.target.value)} />
              </div>
              <div className={rp.field}>
                <label>Važi do (opciono)</label>
                <input type="date" value={form.applies_until} onChange={e => f('applies_until', e.target.value)} />
              </div>
            </>)}
          </div>

          <label className={rp.toggleRow}>
            <span className={`${rp.toggle} ${form.is_active ? rp.toggleOn : rp.toggleOff}`}
              onClick={() => f('is_active', !form.is_active)} />
            <span>Plan aktivan</span>
          </label>

          <div className={rp.formActions}>
            <button className={styles.btnSecondary} onClick={() => setShowForm(false)}>Odustani</button>
            <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
              {saving ? 'Čuvanje...' : 'Sačuvaj'}
            </button>
          </div>
        </div>
      )}

      {/* ── PACKAGES section ── */}
      <div className={rp.sectionHeader}>
        <span className={rp.sectionTitle}>Paketi</span>
        <span className={rp.sectionHint}>Fiksna cijena po tipu sobe</span>
      </div>

      {packages.length === 0 && !showForm ? (
        <div className={rp.empty}>
          <div className={rp.emptyIcon}>🏷️</div>
          <p>Nema paketa. Dodajte "Samo soba", "Sa doručkom" i sl. po svakom tipu sobe.</p>
        </div>
      ) : (
        <div className={rp.planList}>
          {packages.map(plan => {
            const rtName = roomTypes.find(r => r.id === plan.room_type_id)?.name
            return (
              <div key={plan.id} className={rp.planCard}>
                <div className={rp.planCardHeader}>
                  <div className={rp.planInfo}>
                    <div className={rp.planName}>
                      {plan.name}
                      {!plan.room_type_id && <span className={rp.badgeWarn}>Nije vezano za sobu</span>}
                      {!plan.is_active && <span className={rp.badge}>Neaktivan</span>}
                    </div>
                    {plan.description && <div className={rp.planDesc}>{plan.description}</div>}
                    <div className={rp.planMeta}>
                      {rtName && <span className={rp.planRoomType}>{rtName}</span>}
                      <span className={rp.planPrice}>€{Number(plan.price_per_night).toFixed(2)}/noć</span>
                      <span className={rp.planDot}>·</span>
                      <span>Min. {plan.min_stay} {plan.min_stay === 1 ? 'noć' : 'noći'}</span>
                      <span className={rp.planDot}>·</span>
                      <span>{CANCEL_OPTIONS.find(o => o.value === plan.cancellation_policy)?.label.split('—')[0].trim()}</span>
                    </div>
                  </div>
                  <div className={rp.planActions}>
                    <button className={rp.btnEdit} onClick={() => openEdit(plan)}>Uredi</button>
                    <button className={rp.btnExpand} onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}>
                      {expandedPlan === plan.id ? 'Zatvori' : `Sezone (${plan.seasonal_rates?.length ?? 0})`}
                    </button>
                    <button className={rp.btnDelete} onClick={() => handleDelete(plan.id)}>Obriši</button>
                  </div>
                </div>

                {expandedPlan === plan.id && (
                  <div className={rp.seasonSection}>
                    <div className={rp.seasonHeader}>
                      <span className={rp.seasonTitle}>Sezonske cijene (override)</span>
                      <button className={rp.btnAddSeason} onClick={() => openNewSeason(plan.id)}>+ Dodaj</button>
                    </div>
                    {seasonForm?.planId === plan.id && (
                      <div className={rp.seasonForm}>
                        <div className={rp.seasonFormGrid}>
                          <div className={rp.field}><label>Naziv</label>
                            <input value={seasonForm.data.label} onChange={e => setSeasonForm(f => ({ ...f, data: { ...f.data, label: e.target.value } }))} placeholder="Ljetna sezona" /></div>
                          <div className={rp.field}><label>Cijena/noć (€)</label>
                            <input type="number" min="0" step="0.01" value={seasonForm.data.price_per_night} onChange={e => setSeasonForm(f => ({ ...f, data: { ...f.data, price_per_night: e.target.value } }))} /></div>
                          <div className={rp.field}><label>Od</label>
                            <input type="date" value={seasonForm.data.start_date} onChange={e => setSeasonForm(f => ({ ...f, data: { ...f.data, start_date: e.target.value } }))} /></div>
                          <div className={rp.field}><label>Do</label>
                            <input type="date" value={seasonForm.data.end_date} onChange={e => setSeasonForm(f => ({ ...f, data: { ...f.data, end_date: e.target.value } }))} /></div>
                        </div>
                        <div className={rp.seasonFormActions}>
                          <button className={styles.btnSecondary} onClick={() => setSeasonForm(null)}>Odustani</button>
                          <button className={styles.btnPrimary} onClick={handleSaveSeason}>Sačuvaj</button>
                        </div>
                      </div>
                    )}
                    {plan.seasonal_rates?.length === 0 && !seasonForm && (
                      <p className={rp.seasonEmpty}>Nema sezonskih override-a.</p>
                    )}
                    {plan.seasonal_rates?.map(s => (
                      <div key={s.id} className={rp.seasonRow}>
                        <div className={rp.seasonRowInfo}>
                          <span className={rp.seasonRowLabel}>{s.label || 'Sezona'}</span>
                          <span className={rp.seasonRowDates}>{s.start_date} — {s.end_date}</span>
                        </div>
                        <span className={rp.seasonRowPrice}>€{Number(s.price_per_night).toFixed(2)}/noć</span>
                        <div className={rp.seasonRowActions}>
                          <button className={rp.btnEdit} onClick={() => openEditSeason(plan.id, s)}>Uredi</button>
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
        <span className={rp.sectionTitle}>Sezonski multiplikatori</span>
        <span className={rp.sectionHint}>Hotel-wide — primjenjuje se na sve sobe i pakete</span>
      </div>

      {seasonals.length === 0 ? (
        <div className={rp.empty}>
          <div className={rp.emptyIcon}>📅</div>
          <p>Nema sezonskih multiplikatora. Bez multiplikatora koriste se osnovne cijene.</p>
        </div>
      ) : (
        <div className={rp.planList}>
          {seasonals.map(plan => (
            <div key={plan.id} className={rp.planCard}>
              <div className={rp.planCardHeader}>
                <div className={rp.planInfo}>
                  <div className={rp.planName}>
                    {plan.name}
                    {!plan.is_active && <span className={rp.badge}>Neaktivan</span>}
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
                      <><span className={rp.planDot}>·</span><span>Uvijek aktivan</span></>
                    )}
                  </div>
                </div>
                <div className={rp.planActions}>
                  <button className={rp.btnEdit} onClick={() => openEdit(plan)}>Uredi</button>
                  <button className={rp.btnDelete} onClick={() => handleDelete(plan.id)}>Obriši</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
