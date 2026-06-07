import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'
import styles from './NutritionAdmin.module.css'

// EU-14 alergeni (crnogorski). Čuvaju se kao text[] u recipe_ingredient_nutrition.allergens.
const ALLERGENS = [
  'Gluten', 'Rakovi', 'Jaja', 'Riba', 'Kikiriki', 'Soja', 'Mlijeko',
  'Orašasti plodovi', 'Celer', 'Senf', 'Susam', 'Sulfiti', 'Lupin', 'Mekušci',
]

const EMPTY = { nm: '', kcal: '', allergens: [] }

// Superadmin: upravljanje nutritivnom referencom (sastojak → kcal/jed. + alergeni).
// Tu mapu koristi "Preračunaj iz sastojaka" u editoru biblioteke recepata.
export default function NutritionAdmin() {
  const { isSuperAdmin } = usePlatform()
  const navigate = useNavigate()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null) // nm | 'new' | null
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('recipe_ingredient_nutrition').select('nm, kcal, allergens').order('nm')
    setRows(data || [])
    setLoading(false)
  }

  const filtered = rows.filter(r => !search || r.nm.includes(search.toLowerCase()))

  const openNew = () => { setEditing('new'); setForm(EMPTY); setMsg('') }
  const openEdit = (r) => {
    setEditing(r.nm); setMsg('')
    setForm({ nm: r.nm, kcal: String(r.kcal), allergens: [...(r.allergens || [])] })
  }
  const close = () => { setEditing(null); setMsg('') }

  const toggleAllergen = (a) => setForm(f => ({
    ...f, allergens: f.allergens.includes(a) ? f.allergens.filter(x => x !== a) : [...f.allergens, a],
  }))

  const save = async () => {
    const isNew = editing === 'new'
    const nm = (isNew ? form.nm : editing).trim().toLowerCase()
    if (!nm) { setMsg('Naziv je obavezan.'); return }
    if (form.kcal === '' || isNaN(parseFloat(form.kcal))) { setMsg('kcal mora biti broj.'); return }

    setSaving(true)
    const payload = { nm, kcal: parseFloat(form.kcal), allergens: form.allergens }
    // upsert: insert za novi, update za postojeći (nm je PK)
    const { error } = await supabase.from('recipe_ingredient_nutrition')
      .upsert(payload, { onConflict: 'nm' })
    setSaving(false)
    if (error) { setMsg('Greška: ' + error.message); return }
    close()
    await load()
  }

  const del = async (r) => {
    if (!confirm(`Obrisati "${r.nm}" iz nutritivne tabele?`)) return
    const { error } = await supabase.from('recipe_ingredient_nutrition').delete().eq('nm', r.nm)
    if (!error) setRows(rs => rs.filter(x => x.nm !== r.nm))
  }

  if (!isSuperAdmin()) {
    return <div className={styles.denied}><div>🔒</div><div>Nemate pristup ovoj stranici.</div></div>
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Nutritivna tabela sastojaka</div>
          <div className={styles.sub}>kcal po jedinici + alergeni — koristi „Preračunaj" u biblioteci recepata</div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnNew} onClick={openNew}>+ Novi sastojak</button>
          <button className={styles.btnBack} onClick={() => navigate('/superadmin/recipes')}>← Recepti</button>
        </div>
      </div>

      <input className={styles.search} placeholder="Pretraži sastojak…" value={search}
        onChange={e => setSearch(e.target.value)} />

      {loading ? (
        <div className={styles.loading}>Učitavanje…</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Sastojak</th><th>kcal / jed.</th><th>Alergeni</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={4} className={styles.empty}>Nema rezultata.</td></tr>
              )}
              {filtered.map(r => (
                <tr key={r.nm}>
                  <td className={styles.nm}>{r.nm}</td>
                  <td>{Number(r.kcal)}</td>
                  <td className={styles.alg}>{(r.allergens || []).join(', ') || '—'}</td>
                  <td className={styles.actions}>
                    <button className={styles.btnEdit} onClick={() => openEdit(r)}>Uredi</button>
                    <button className={styles.btnDel} onClick={() => del(r)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className={styles.overlay} onClick={close}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>{editing === 'new' ? 'Novi sastojak' : `Uredi: ${editing}`}</div>
              <button className={styles.modalClose} onClick={close}>✕</button>
            </div>
            <div className={styles.modalBody}>
              {editing === 'new' ? (
                <div className={styles.field}>
                  <label>Naziv sastojka *</label>
                  <input value={form.nm} onChange={e => setForm(f => ({ ...f, nm: e.target.value }))}
                    placeholder="npr. limeta (mala slova, kako se piše u receptu)" />
                  <div className={styles.hint}>Mora se tačno poklapati s nazivom u sastojcima recepta (mala slova).</div>
                </div>
              ) : (
                <div className={styles.field}><label>Naziv</label><div className={styles.nmFixed}>{editing}</div></div>
              )}
              <div className={styles.field}>
                <label>kcal po jedinici (ml / g / kom) *</label>
                <input type="number" step="0.01" value={form.kcal}
                  onChange={e => setForm(f => ({ ...f, kcal: e.target.value }))} placeholder="npr. 2.3" />
              </div>
              <div className={styles.field}>
                <label>Alergeni</label>
                <div className={styles.algGrid}>
                  {ALLERGENS.map(a => (
                    <label key={a} className={`${styles.algChip} ${form.allergens.includes(a) ? styles.algChipOn : ''}`}>
                      <input type="checkbox" checked={form.allergens.includes(a)} onChange={() => toggleAllergen(a)} />
                      {a}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              {msg && <span className={styles.msg}>{msg}</span>}
              <button className={styles.btnCancel} onClick={close}>Odustani</button>
              <button className={styles.btnSave} onClick={save} disabled={saving}>
                {saving ? 'Čuvanje…' : 'Sačuvaj'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
