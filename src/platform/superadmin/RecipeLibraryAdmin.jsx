import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'
import styles from './RecipeLibraryAdmin.module.css'

const TABS = [
  { key: 'coffee',   label: '☕ Kafa' },
  { key: 'cocktail', label: '🍸 Kokteli' },
  { key: 'other',    label: '🍹 Ostalo' },
]
const BUCKET = 'recipe-library'

// Superadmin pregled/zamjena slika biblioteke recepata.
export default function RecipeLibraryAdmin() {
  const { isSuperAdmin } = usePlatform()
  const navigate = useNavigate()

  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('coffee')
  const [busyId, setBusyId] = useState(null)
  const fileInputs = useRef({})

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('recipe_library')
      .select('id, name, category, emoji, image_url, is_active')
      .order('sort_order')
    setRecipes(data || [])
    setLoading(false)
  }

  const catOf = (r) => (r.category === 'coffee' || r.category === 'cocktail') ? r.category : 'other'
  const visible = recipes.filter(r => catOf(r) === tab)

  const uploadImage = async (recipe, file) => {
    if (!file) return
    setBusyId(recipe.id)
    const path = `${recipe.id}.jpg`
    const { error: upErr } = await supabase.storage.from(BUCKET)
      .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: true })
    if (upErr) {
      alert('Greška pri uploadu: ' + upErr.message)
      setBusyId(null)
      return
    }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
    // cache-bust: ista putanja se prepisuje, dodaj verziju da se nova slika prikaže
    const url = `${pub.publicUrl}?v=${Date.now()}`
    const { error: updErr } = await supabase.from('recipe_library')
      .update({ image_url: url }).eq('id', recipe.id)
    if (updErr) alert('Greška pri upisu: ' + updErr.message)
    else setRecipes(rs => rs.map(r => r.id === recipe.id ? { ...r, image_url: url } : r))
    setBusyId(null)
  }

  const removeImage = async (recipe) => {
    if (!confirm(`Ukloniti sliku za "${recipe.name}"? Vraća se na emoji ikonu.`)) return
    setBusyId(recipe.id)
    await supabase.storage.from(BUCKET).remove([`${recipe.id}.jpg`])
    const { error } = await supabase.from('recipe_library')
      .update({ image_url: null }).eq('id', recipe.id)
    if (!error) setRecipes(rs => rs.map(r => r.id === recipe.id ? { ...r, image_url: null } : r))
    setBusyId(null)
  }

  const toggleActive = async (recipe) => {
    const next = !recipe.is_active
    const { error } = await supabase.from('recipe_library')
      .update({ is_active: next }).eq('id', recipe.id)
    if (!error) setRecipes(rs => rs.map(r => r.id === recipe.id ? { ...r, is_active: next } : r))
  }

  if (!isSuperAdmin()) {
    return (
      <div className={styles.denied}>
        <div>🔒</div>
        <div>Nemate pristup ovoj stranici.</div>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Biblioteka recepata — slike</div>
          <div className={styles.sub}>Pregled i zamjena slika preddefinisanih recepata</div>
        </div>
        <button className={styles.btnBack} onClick={() => navigate('/superadmin')}>← Super admin</button>
      </div>

      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.key}
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
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
                  ? <img src={r.image_url} alt={r.name} className={styles.previewImg} />
                  : <span className={styles.previewEmoji}>{r.emoji}</span>}
                {busyId === r.id && <div className={styles.busy}>…</div>}
              </div>
              <div className={styles.cardName}>{r.name}</div>
              <div className={styles.cardActions}>
                <button
                  className={styles.btnUpload}
                  disabled={busyId === r.id}
                  onClick={() => fileInputs.current[r.id]?.click()}
                >
                  {r.image_url ? 'Zamijeni' : 'Dodaj sliku'}
                </button>
                {r.image_url && (
                  <button className={styles.btnRemove} disabled={busyId === r.id} onClick={() => removeImage(r)}>
                    Ukloni
                  </button>
                )}
                <input
                  ref={el => { fileInputs.current[r.id] = el }}
                  type="file"
                  accept="image/*"
                  hidden
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
    </div>
  )
}
