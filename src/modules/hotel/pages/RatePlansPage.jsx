import { useState } from 'react'
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
  name: '', description: '', price_per_night: '',
  min_stay: 1, max_stay: '', cancellation_policy: 'flexible',
  advance_booking_days: '', is_active: true,
}

const BLANK_SEASON = {
  label: '', start_date: '', end_date: '', price_per_night: '',
}

export default function RatePlansPage() {
  const { restaurant } = usePlatform()
  const { ratePlans, loading, refetch } = useRatePlans(restaurant?.id)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK_PLAN)
  const [saving, setSaving] = useState(false)

  const [expandedPlan, setExpandedPlan] = useState(null)
  const [seasonForm, setSeasonForm] = useState(null) // { planId, data, editing }

  const openNew = () => { setEditing(null); setForm(BLANK_PLAN); setShowForm(true) }
  const openEdit = (p) => {
    setEditing(p)
    setForm({
      name: p.name,
      description: p.description ?? '',
      price_per_night: p.price_per_night ?? '',
      min_stay: p.min_stay ?? 1,
      max_stay: p.max_stay ?? '',
      cancellation_policy: p.cancellation_policy ?? 'flexible',
      advance_booking_days: p.advance_booking_days ?? '',
      is_active: p.is_active,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Naziv je obavezan')
    if (!form.price_per_night) return toast.error('Cijena je obavezna')
    setSaving(true)
    const payload = {
      ...form,
      price_per_night: parseFloat(form.price_per_night),
      min_stay: parseInt(form.min_stay) || 1,
      max_stay: form.max_stay ? parseInt(form.max_stay) : null,
      advance_booking_days: form.advance_booking_days ? parseInt(form.advance_booking_days) : null,
      restaurant_id: restaurant.id,
    }
    const { error } = editing
      ? await supabase.from('rate_plans').update(payload).eq('id', editing.id)
      : await supabase.from('rate_plans').insert(payload)
    setSaving(false)
    if (error) return toast.error('Greška pri čuvanju')
    toast.success(editing ? 'Plan ažuriran' : 'Plan dodan')
    setShowForm(false)
    refetch()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Obrisati ovaj plan? Svi vezani sezonski zapisi će biti obrisani.')) return
    const { error } = await supabase.from('rate_plans').delete().eq('id', id)
    if (error) return toast.error('Greška pri brisanju')
    toast.success('Plan obrisan')
    refetch()
  }

  const openNewSeason = (planId) => setSeasonForm({ planId, data: BLANK_SEASON, editing: null })
  const openEditSeason = (planId, s) => setSeasonForm({
    planId,
    data: { label: s.label ?? '', start_date: s.start_date, end_date: s.end_date, price_per_night: s.price_per_night },
    editing: s.id,
  })

  const handleSaveSeason = async () => {
    const { planId, data, editing: sid } = seasonForm
    if (!data.start_date || !data.end_date || !data.price_per_night) return toast.error('Datum i cijena su obavezni')
    const payload = {
      ...data,
      price_per_night: parseFloat(data.price_per_night),
      rate_plan_id: planId,
      restaurant_id: restaurant.id,
    }
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

  if (loading) return <LoadingSpinner fullPage />

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Cjenovni planovi</h1>
          <p className={styles.subtitle}>Upravljanje cijenama i sezonskim stopama</p>
        </div>
        <button className={styles.btnPrimary} onClick={openNew}>+ Novi plan</button>
      </div>

      {/* Form */}
      {showForm && (
        <div className={rp.formPanel}>
          <div className={rp.formHeader}>
            <span className={rp.formTitle}>{editing ? `Uredi: ${editing.name}` : 'Novi cjenovni plan'}</span>
            <button className={rp.formClose} onClick={() => setShowForm(false)}>✕</button>
          </div>
          <div className={rp.formGrid}>
            <div className={rp.field}>
              <label>Naziv plana</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="npr. Standardna cijena" />
            </div>
            <div className={rp.field}>
              <label>Cijena po noći (€)</label>
              <input type="number" min="0" step="0.01" value={form.price_per_night} onChange={e => setForm(f => ({ ...f, price_per_night: e.target.value }))} placeholder="0.00" />
            </div>
            <div className={rp.field} style={{ gridColumn: '1 / -1' }}>
              <label>Opis</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Kratki opis za goste (opciono)" />
            </div>
            <div className={rp.field}>
              <label>Min. boravak (noći)</label>
              <input type="number" min="1" value={form.min_stay} onChange={e => setForm(f => ({ ...f, min_stay: e.target.value }))} />
            </div>
            <div className={rp.field}>
              <label>Max. boravak (noći, opciono)</label>
              <input type="number" min="1" value={form.max_stay} onChange={e => setForm(f => ({ ...f, max_stay: e.target.value }))} placeholder="Neograničeno" />
            </div>
            <div className={rp.field}>
              <label>Politika otkazivanja</label>
              <select value={form.cancellation_policy} onChange={e => setForm(f => ({ ...f, cancellation_policy: e.target.value }))}>
                {CANCEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className={rp.field}>
              <label>Min. dana unaprijed (opciono)</label>
              <input type="number" min="0" value={form.advance_booking_days} onChange={e => setForm(f => ({ ...f, advance_booking_days: e.target.value }))} placeholder="0 = odmah" />
            </div>
          </div>
          <label className={rp.toggleRow}>
            <span className={`${rp.toggle} ${form.is_active ? rp.toggleOn : rp.toggleOff}`} onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))} />
            <span>Plan aktivan (vidljiv gostima)</span>
          </label>
          <div className={rp.formActions}>
            <button className={styles.btnSecondary} onClick={() => setShowForm(false)}>Odustani</button>
            <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>{saving ? 'Čuvanje...' : 'Sačuvaj'}</button>
          </div>
        </div>
      )}

      {/* List */}
      {ratePlans.length === 0 && !showForm ? (
        <div className={rp.empty}>
          <div className={rp.emptyIcon}>🏷️</div>
          <p>Nema cjenovnih planova. Dodajte prvi plan da biste omogućili online rezervacije.</p>
        </div>
      ) : (
        <div className={rp.planList}>
          {ratePlans.map(plan => (
            <div key={plan.id} className={rp.planCard}>
              <div className={rp.planCardHeader}>
                <div className={rp.planInfo}>
                  <div className={rp.planName}>{plan.name}</div>
                  {plan.description && <div className={rp.planDesc}>{plan.description}</div>}
                  <div className={rp.planMeta}>
                    <span className={rp.planPrice}>€{Number(plan.price_per_night).toFixed(2)}/noć</span>
                    <span className={rp.planDot}>·</span>
                    <span>Min. {plan.min_stay} {plan.min_stay === 1 ? 'noć' : 'noći'}</span>
                    <span className={rp.planDot}>·</span>
                    <span>{CANCEL_OPTIONS.find(o => o.value === plan.cancellation_policy)?.label.split('—')[0].trim()}</span>
                    {!plan.is_active && <span className={rp.badge}>Neaktivan</span>}
                  </div>
                </div>
                <div className={rp.planActions}>
                  <button className={rp.btnEdit} onClick={() => openEdit(plan)}>Uredi</button>
                  <button className={rp.btnExpand} onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}>
                    {expandedPlan === plan.id ? 'Zatvori sezone' : `Sezone (${plan.seasonal_rates?.length ?? 0})`}
                  </button>
                  <button className={rp.btnDelete} onClick={() => handleDelete(plan.id)}>Obriši</button>
                </div>
              </div>

              {/* Seasonal rates */}
              {expandedPlan === plan.id && (
                <div className={rp.seasonSection}>
                  <div className={rp.seasonHeader}>
                    <span className={rp.seasonTitle}>Sezonske cijene</span>
                    <button className={rp.btnAddSeason} onClick={() => openNewSeason(plan.id)}>+ Dodaj sezonu</button>
                  </div>

                  {/* Season form */}
                  {seasonForm?.planId === plan.id && (
                    <div className={rp.seasonForm}>
                      <div className={rp.seasonFormGrid}>
                        <div className={rp.field}>
                          <label>Naziv sezone</label>
                          <input value={seasonForm.data.label} onChange={e => setSeasonForm(f => ({ ...f, data: { ...f.data, label: e.target.value } }))} placeholder="npr. Ljetna sezona" />
                        </div>
                        <div className={rp.field}>
                          <label>Cijena po noći (€)</label>
                          <input type="number" min="0" step="0.01" value={seasonForm.data.price_per_night} onChange={e => setSeasonForm(f => ({ ...f, data: { ...f.data, price_per_night: e.target.value } }))} placeholder="0.00" />
                        </div>
                        <div className={rp.field}>
                          <label>Od datuma</label>
                          <input type="date" value={seasonForm.data.start_date} onChange={e => setSeasonForm(f => ({ ...f, data: { ...f.data, start_date: e.target.value } }))} />
                        </div>
                        <div className={rp.field}>
                          <label>Do datuma</label>
                          <input type="date" value={seasonForm.data.end_date} onChange={e => setSeasonForm(f => ({ ...f, data: { ...f.data, end_date: e.target.value } }))} />
                        </div>
                      </div>
                      <div className={rp.seasonFormActions}>
                        <button className={styles.btnSecondary} onClick={() => setSeasonForm(null)}>Odustani</button>
                        <button className={styles.btnPrimary} onClick={handleSaveSeason}>Sačuvaj</button>
                      </div>
                    </div>
                  )}

                  {plan.seasonal_rates?.length === 0 && !seasonForm && (
                    <p className={rp.seasonEmpty}>Nema sezonskih cijena. Plan koristi osnovnu cijenu tokom cijele godine.</p>
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
          ))}
        </div>
      )}
    </div>
  )
}
