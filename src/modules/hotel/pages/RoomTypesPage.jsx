import { useState } from 'react'
import { usePlatform } from '../../../context/PlatformContext'
import { useRooms } from '../hooks/useRooms'
import { supabase } from '../../../lib/supabase'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import styles from './Hotel.module.css'

const AMENITY_OPTIONS = ['WiFi', 'Klima', 'Balkon', 'Minibar', 'Sef', 'TV', 'Kada', 'Tuš', 'Parking', 'Pogled na more', 'Kuhinja']

export default function RoomTypesPage() {
  const { restaurant } = usePlatform()
  const { roomTypes, loading, refetch } = useRooms(restaurant?.id)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', max_occupancy: 2, base_price: '', amenities: [] })
  const [saving, setSaving] = useState(false)

  const openNew = () => { setEditing(null); setForm({ name: '', description: '', max_occupancy: 2, base_price: '', amenities: [] }); setShowForm(true) }
  const openEdit = (rt) => { setEditing(rt); setForm({ name: rt.name, description: rt.description ?? '', max_occupancy: rt.max_occupancy, base_price: rt.base_price ?? '', amenities: rt.amenities ?? [] }); setShowForm(true) }

  const toggleAmenity = (a) => setForm(f => ({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter(x => x !== a) : [...f.amenities, a] }))

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Naziv je obavezan')
    setSaving(true)
    const payload = { ...form, base_price: parseFloat(form.base_price) || null, restaurant_id: restaurant.id }
    const { error } = editing
      ? await supabase.from('room_types').update(payload).eq('id', editing.id)
      : await supabase.from('room_types').insert(payload)
    setSaving(false)
    if (error) return toast.error('Greška pri čuvanju')
    toast.success(editing ? 'Tip ažuriran' : 'Tip dodan')
    setShowForm(false)
    refetch()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Obrisati ovaj tip sobe?')) return
    await supabase.from('room_types').delete().eq('id', id)
    toast.success('Tip obrisan')
    refetch()
  }

  if (loading) return <LoadingSpinner fullPage />

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Tipovi soba</h1>
          <p className={styles.subtitle}>{roomTypes.length} tipova</p>
        </div>
        <button className={styles.btnPrimary} onClick={openNew}>+ Novi tip</button>
      </div>

      {roomTypes.length === 0 && !showForm && (
        <div className={styles.empty}>
          <p>Nema tipova soba. Dodajte prvi tip da biste mogli kreirati sobe.</p>
        </div>
      )}

      <div className={styles.typeList}>
        {roomTypes.map(rt => (
          <div key={rt.id} className={styles.typeCard}>
            <div className={styles.typeInfo}>
              <div className={styles.typeName}>{rt.name}</div>
              <div className={styles.typeMeta}>Max {rt.max_occupancy} gosta{rt.base_price ? ` · €${rt.base_price}/noć` : ''}</div>
              {rt.description && <div className={styles.typeDesc}>{rt.description}</div>}
              {rt.amenities?.length > 0 && (
                <div className={styles.amenities}>{rt.amenities.map(a => <span key={a} className={styles.amenity}>{a}</span>)}</div>
              )}
            </div>
            <div className={styles.typeActions}>
              <button className={styles.btnIcon} onClick={() => openEdit(rt)}>✏️</button>
              <button className={styles.btnIcon} onClick={() => handleDelete(rt.id)}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className={styles.formOverlay}>
          <div className={styles.formCard}>
            <h3 className={styles.formTitle}>{editing ? 'Uredi tip sobe' : 'Novi tip sobe'}</h3>
            <div className={styles.formGrid}>
              <label className={styles.formLabel}>Naziv *
                <input className={styles.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Standard, Deluxe, Suite..." />
              </label>
              <label className={styles.formLabel}>Max gostiju
                <input className={styles.input} type="number" min={1} max={20} value={form.max_occupancy} onChange={e => setForm(f => ({ ...f, max_occupancy: parseInt(e.target.value) }))} />
              </label>
              <label className={styles.formLabel}>Cijena po noći (€)
                <input className={styles.input} type="number" min={0} value={form.base_price} onChange={e => setForm(f => ({ ...f, base_price: e.target.value }))} placeholder="0.00" />
              </label>
              <label className={styles.formLabel} style={{ gridColumn: '1/-1' }}>Opis
                <textarea className={`${styles.input} ${styles.textarea}`} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Opis tipa sobe..." />
              </label>
            </div>
            <div className={styles.formLabel}>Sadržaj
              <div className={styles.amenityGrid}>
                {AMENITY_OPTIONS.map(a => (
                  <button key={a} type="button"
                    className={`${styles.amenityBtn} ${form.amenities.includes(a) ? styles.amenityBtnActive : ''}`}
                    onClick={() => toggleAmenity(a)}
                  >{a}</button>
                ))}
              </div>
            </div>
            <div className={styles.formActions}>
              <button className={styles.btnSecondary} onClick={() => setShowForm(false)}>Otkaži</button>
              <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>{saving ? 'Čuvanje...' : 'Sačuvaj'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
