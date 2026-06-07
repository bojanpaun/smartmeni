import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'
import styles from './RecipeLibraryAdmin.module.css'

const BUCKET = 'recipe-library'
const UNITS = ['ml', 'g', 'kom']
const CAT_ORDER = ['coffee', 'cocktail', 'soft', 'hot', 'beverage', 'food', 'salad', 'breakfast', 'dessert']
const CAT_LABEL = {
  coffee: '☕ Kafa', cocktail: '🍸 Kokteli', soft: '🥤 Bezalkoholna', hot: '🍵 Topli napici',
  beverage: '🍺 Pivo/vino', food: '🍽️ Jela', salad: '🥗 Salate/predjela',
  breakfast: '🍳 Doručak', dessert: '🍰 Deserti',
}
const catOrder = (c) => { const i = CAT_ORDER.indexOf(c); return i < 0 ? 99 : i }

const EMPTY_FORM = {
  id: '', name: '', name_en: '', category: 'coffee', emoji: '🍽️',
  suggested_price: '', prep_time: '', instructions: '', description_en: '',
  allergens: '', calories: '', is_active: true,
}

// Superadmin: pregled, uređivanje (sva polja + sastojci) i slike biblioteke recepata.
export default function RecipeLibraryAdmin() {
  const { isSuperAdmin } = usePlatform()
  const navigate = useNavigate()

  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const fileInputs = useRef({})

  // Edit modal
  const [editing, setEditing] = useState(null) // recipe id ('new' za novi) ili null
  const [form, setForm] = useState(EMPTY_FORM)
  const [ings, setIngs] = useState([])
  const [savingEdit, setSavingEdit] = useState(false)
  const [editMsg, setEditMsg] = useState('')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('recipe_library')
      .select('id, name, name_en, category, emoji, image_url, is_active, suggested_price, prep_time, instructions, description_en, allergens, calories, sort_order')
      .order('sort_order')
    setRecipes(data || [])
    setTab(t => t || [...new Set((data || []).map(r => r.category))].sort((a, b) => catOrder(a) - catOrder(b))[0] || 'coffee')
    setLoading(false)
  }

  const tabs = [...new Set(recipes.map(r => r.category))].sort((a, b) => catOrder(a) - catOrder(b))
  const visible = recipes.filter(r => r.category === tab)

  // ── Slike ──────────────────────────────────────────────────────────────────
  const uploadImage = async (recipe, file) => {
    if (!file) return
    setBusyId(recipe.id)
    const path = `${recipe.id}.jpg`
    const { error: upErr } = await supabase.storage.from(BUCKET)
      .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: true })
    if (upErr) { alert('Greška pri uploadu: ' + upErr.message); setBusyId(null); return }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const url = `${pub.publicUrl}?v=${Date.now()}`
    const { error: updErr } = await supabase.from('recipe_library').update({ image_url: url }).eq('id', recipe.id)
    if (updErr) alert('Greška pri upisu: ' + updErr.message)
    else setRecipes(rs => rs.map(r => r.id === recipe.id ? { ...r, image_url: url } : r))
    setBusyId(null)
  }

  const removeImage = async (recipe) => {
    if (!confirm(`Ukloniti sliku za "${recipe.name}"? Vraća se na emoji ikonu.`)) return
    setBusyId(recipe.id)
    await supabase.storage.from(BUCKET).remove([`${recipe.id}.jpg`])
    const { error } = await supabase.from('recipe_library').update({ image_url: null }).eq('id', recipe.id)
    if (!error) setRecipes(rs => rs.map(r => r.id === recipe.id ? { ...r, image_url: null } : r))
    setBusyId(null)
  }

  const toggleActive = async (recipe) => {
    const next = !recipe.is_active
    const { error } = await supabase.from('recipe_library').update({ is_active: next }).eq('id', recipe.id)
    if (!error) setRecipes(rs => rs.map(r => r.id === recipe.id ? { ...r, is_active: next } : r))
  }

  // ── Uređivanje recepta ───────────────────────────────────────────────────
  const openEdit = async (recipe) => {
    setEditing(recipe.id)
    setEditMsg('')
    setForm({
      id: recipe.id, name: recipe.name || '', name_en: recipe.name_en || '',
      category: recipe.category || 'coffee', emoji: recipe.emoji || '🍽️',
      suggested_price: recipe.suggested_price ?? '', prep_time: recipe.prep_time || '',
      instructions: recipe.instructions || '', description_en: recipe.description_en || '',
      allergens: recipe.allergens || '', calories: recipe.calories ?? '', is_active: !!recipe.is_active,
    })
    const { data } = await supabase.from('recipe_library_ingredients')
      .select('id, ingredient_name, quantity, unit, sort_order')
      .eq('recipe_id', recipe.id).order('sort_order')
    setIngs((data || []).map(i => ({ ingredient_name: i.ingredient_name, quantity: String(i.quantity), unit: i.unit })))
  }

  const openNew = () => {
    setEditing('new')
    setEditMsg('')
    setForm({ ...EMPTY_FORM, category: tab || 'coffee' })
    setIngs([])
  }

  const closeEdit = () => { setEditing(null); setEditMsg('') }

  // Preračun kalorija + alergena iz trenutnih (nesačuvanih) sastojaka.
  const recompute = async () => {
    const { data: nut, error } = await supabase
      .from('recipe_ingredient_nutrition').select('nm, kcal, allergens')
    if (error) { setEditMsg('Greška pri čitanju nutritivne tabele.'); return }
    const map = {}
    for (const n of (nut || [])) map[n.nm] = n
    let kcal = 0
    const alg = new Set()
    const unknown = []
    for (const ing of ings) {
      const nm = ing.ingredient_name.trim().toLowerCase()
      if (!nm) continue
      const m = map[nm]
      if (!m) { unknown.push(ing.ingredient_name.trim()); continue }
      kcal += (parseFloat(ing.quantity) || 0) * Number(m.kcal)
      for (const a of (m.allergens || [])) alg.add(a)
    }
    setForm(f => ({ ...f, calories: String(Math.round(kcal)), allergens: [...alg].sort().join(', ') }))
    setEditMsg(unknown.length
      ? `Preračunato. Nepoznati sastojci (računati kao 0 kcal): ${unknown.join(', ')}`
      : 'Preračunato iz sastojaka.')
  }

  const deleteRecipe = async (recipe) => {
    if (!confirm(`Obrisati recept "${recipe.name}" iz biblioteke? Sastojci se brišu zajedno.\n\nNe utiče na stavke koje su tenanti već uvezli.`)) return
    setSavingEdit(true)
    await supabase.storage.from(BUCKET).remove([`${recipe.id}.jpg`]) // best-effort
    const { error } = await supabase.from('recipe_library').delete().eq('id', recipe.id)
    if (error) { setEditMsg('Greška: ' + error.message); setSavingEdit(false); return }
    setSavingEdit(false)
    closeEdit()
    await load()
  }

  const addIngRow = () => setIngs(prev => [...prev, { ingredient_name: '', quantity: '', unit: 'ml' }])
  const updateIng = (i, field, val) => setIngs(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: val } : row))
  const removeIngRow = (i) => setIngs(prev => prev.filter((_, idx) => idx !== i))

  const saveEdit = async () => {
    const isNew = editing === 'new'
    const id = (isNew ? form.id : editing).trim()
    if (!id) { setEditMsg('ID (slug) je obavezan.'); return }
    if (!/^[a-z0-9_]+$/.test(id)) { setEditMsg('ID smije sadržati samo mala slova, brojeve i _.'); return }
    if (!form.name.trim()) { setEditMsg('Naziv je obavezan.'); return }

    setSavingEdit(true)
    const payload = {
      name: form.name.trim(),
      name_en: form.name_en.trim() || null,
      category: form.category,
      emoji: form.emoji || '🍽️',
      suggested_price: form.suggested_price === '' ? null : parseFloat(form.suggested_price),
      prep_time: form.prep_time.trim() || null,
      instructions: form.instructions.trim() || null,
      description_en: form.description_en.trim() || null,
      allergens: form.allergens.trim() || null,
      calories: form.calories === '' ? null : parseInt(form.calories),
      is_active: form.is_active,
    }

    let error
    if (isNew) {
      ({ error } = await supabase.from('recipe_library').insert({ id, ...payload }))
    } else {
      ({ error } = await supabase.from('recipe_library').update(payload).eq('id', id))
    }
    if (error) { setEditMsg('Greška: ' + error.message); setSavingEdit(false); return }

    // Sastojci: obriši pa upiši (jednostavna sinhronizacija).
    await supabase.from('recipe_library_ingredients').delete().eq('recipe_id', id)
    const rows = ings
      .filter(i => i.ingredient_name.trim())
      .map((i, idx) => ({
        recipe_id: id, ingredient_name: i.ingredient_name.trim(),
        quantity: parseFloat(i.quantity) || 0, unit: i.unit || 'kom', sort_order: idx + 1,
      }))
    if (rows.length) await supabase.from('recipe_library_ingredients').insert(rows)

    setSavingEdit(false)
    closeEdit()
    await load()
  }

  if (!isSuperAdmin()) {
    return <div className={styles.denied}><div>🔒</div><div>Nemate pristup ovoj stranici.</div></div>
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Biblioteka recepata</div>
          <div className={styles.sub}>Uređivanje recepata, sastojaka i slika</div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnNew} onClick={openNew}>+ Novi recept</button>
          <button className={styles.btnBack} onClick={() => navigate('/superadmin')}>← Super admin</button>
        </div>
      </div>

      <div className={styles.tabs}>
        {tabs.map(key => (
          <button key={key} className={`${styles.tab} ${tab === key ? styles.tabActive : ''}`} onClick={() => setTab(key)}>
            {CAT_LABEL[key] || key}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.loading}>Učitavanje…</div>
      ) : visible.length === 0 ? (
        <div className={styles.empty}>Nema stavki u ovoj kategoriji.</div>
      ) : (
        <div className={styles.grid}>
          {visible.map(r => (
            <div key={r.id} className={`${styles.card} ${!r.is_active ? styles.cardInactive : ''}`}>
              <div className={styles.preview}>
                {r.image_url
                  ? <img src={r.image_url} alt={r.name} className={styles.previewImg} loading="lazy" decoding="async" />
                  : <span className={styles.previewEmoji}>{r.emoji}</span>}
                {busyId === r.id && <div className={styles.busy}>…</div>}
              </div>
              <div className={styles.cardName}>{r.name}</div>
              <div className={styles.cardActions}>
                <button className={styles.btnEdit} onClick={() => openEdit(r)}>✏️ Uredi</button>
                <button className={styles.btnUpload} disabled={busyId === r.id} onClick={() => fileInputs.current[r.id]?.click()}>
                  {r.image_url ? 'Slika' : 'Slika +'}
                </button>
                {r.image_url && (
                  <button className={styles.btnRemove} disabled={busyId === r.id} onClick={() => removeImage(r)}>✕</button>
                )}
                <input
                  ref={el => { fileInputs.current[r.id] = el }}
                  type="file" accept="image/*" hidden
                  onChange={e => { uploadImage(r, e.target.files[0]); e.target.value = '' }}
                />
              </div>
              <label className={styles.activeRow}>
                <input type="checkbox" checked={!!r.is_active} onChange={() => toggleActive(r)} />
                <span>Aktivan</span>
              </label>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className={styles.overlay} onClick={closeEdit}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>{editing === 'new' ? 'Novi recept' : 'Uredi recept'}</div>
              <button className={styles.modalClose} onClick={closeEdit}>✕</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGrid}>
                {editing === 'new' && (
                  <div className={`${styles.field} ${styles.full}`}>
                    <label>ID (slug) *</label>
                    <input value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))}
                      placeholder="npr. negroni_sbagliato" />
                    <div className={styles.hint}>Mala slova, brojevi, _ . Ne mijenja se kasnije.</div>
                  </div>
                )}
                <div className={styles.field}>
                  <label>Naziv (ME) *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label>Naziv (EN)</label>
                  <input value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label>Kategorija</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CAT_ORDER.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Emoji</label>
                  <input value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} maxLength={4} />
                </div>
                <div className={styles.field}>
                  <label>Cijena (€)</label>
                  <input type="number" step="0.01" value={form.suggested_price}
                    onChange={e => setForm(f => ({ ...f, suggested_price: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label>Vrijeme pripreme</label>
                  <input value={form.prep_time} onChange={e => setForm(f => ({ ...f, prep_time: e.target.value }))} placeholder="npr. 4 min" />
                </div>
                <div className={`${styles.field} ${styles.full}`}>
                  <label>Opis (ME)</label>
                  <textarea rows={2} value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} />
                </div>
                <div className={`${styles.field} ${styles.full}`}>
                  <label>Opis (EN)</label>
                  <textarea rows={2} value={form.description_en} onChange={e => setForm(f => ({ ...f, description_en: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label>Alergeni</label>
                  <input value={form.allergens} onChange={e => setForm(f => ({ ...f, allergens: e.target.value }))} placeholder="npr. Mlijeko, Jaja" />
                </div>
                <div className={styles.field}>
                  <label>Kalorije</label>
                  <input type="number" value={form.calories} onChange={e => setForm(f => ({ ...f, calories: e.target.value }))} />
                </div>
              </div>
              <div className={styles.recomputeRow}>
                <button type="button" className={styles.btnRecompute} onClick={recompute}>
                  🧮 Preračunaj kalorije i alergene iz sastojaka
                </button>
                <span className={styles.hint}>Popunjava polja iznad na osnovu sastojaka; provjeri prije snimanja.</span>
              </div>

              {/* Sastojci */}
              <div className={styles.ingSection}>
                <div className={styles.ingHead}>
                  <span>Sastojci (recept / BOM)</span>
                  <button className={styles.btnAddIng} onClick={addIngRow}>+ Sastojak</button>
                </div>
                {ings.length === 0 && <div className={styles.hint}>Nema sastojaka. Stavke bez sastojaka uvoze se samo kao stavka menija.</div>}
                {ings.map((ing, i) => (
                  <div key={i} className={styles.ingRow}>
                    <input className={styles.ingName} value={ing.ingredient_name}
                      onChange={e => updateIng(i, 'ingredient_name', e.target.value)} placeholder="Naziv namirnice" />
                    <input className={styles.ingQty} type="number" step="0.001" value={ing.quantity}
                      onChange={e => updateIng(i, 'quantity', e.target.value)} placeholder="Kol." />
                    <select className={styles.ingUnit} value={ing.unit} onChange={e => updateIng(i, 'unit', e.target.value)}>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <button className={styles.ingDel} onClick={() => removeIngRow(i)}>✕</button>
                  </div>
                ))}
              </div>

              <label className={styles.activeRow}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                <span>Aktivan (vidljiv tenantima)</span>
              </label>
            </div>

            <div className={styles.modalFooter}>
              {editing !== 'new' && (
                <button className={styles.btnDelete} onClick={() => deleteRecipe({ id: editing, name: form.name })} disabled={savingEdit}>
                  🗑 Obriši recept
                </button>
              )}
              {editMsg && <span className={styles.editMsg}>{editMsg}</span>}
              <button className={styles.btnCancel} onClick={closeEdit}>Odustani</button>
              <button className={styles.btnSave} onClick={saveEdit} disabled={savingEdit}>
                {savingEdit ? 'Čuvanje…' : 'Sačuvaj'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
