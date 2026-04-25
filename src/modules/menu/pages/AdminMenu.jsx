import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './AdminMenu.module.css'

export default function AdminMenu() {
  const navigate = useNavigate()
  const { user, restaurant: ctxRestaurant } = usePlatform()

  const [restaurant, setRestaurant] = useState(ctxRestaurant)
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [activePage, setActivePage] = useState('dashboard')
  const [activeCategory, setActiveCategory] = useState(null)

  const [showItemForm, setShowItemForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [itemForm, setItemForm] = useState({
    name: '', name_en: '', description: '', description_en: '',
    price: '', emoji: '🍽️', allergens: '', calories: '',
    prep_time: '', category_id: '', is_special: false, tags: []
  })
  const [uploadingImage, setUploadingImage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    if (user && (ctxRestaurant || restaurant)) {
      const rest = ctxRestaurant || restaurant
      setRestaurant(rest)
      loadData(rest.id)
    }
  }, [user, ctxRestaurant])

  const loadData = async (restaurantId) => {
    const { data: cats } = await supabase
      .from('categories')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('sort_order')
    setCategories(cats || [])
    if (cats?.length) setActiveCategory(cats[0].id)

    const { data: its } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('sort_order')
    setItems(its || [])
    setLoading(false)
  }

  const toggleItemVisible = async (item) => {
    await supabase
      .from('menu_items')
      .update({ is_visible: !item.is_visible })
      .eq('id', item.id)
    setItems(items.map(i => i.id === item.id ? { ...i, is_visible: !i.is_visible } : i))
  }

  const deleteItem = async (id) => {
    if (!confirm('Obrisati ovu stavku?')) return
    await supabase.from('menu_items').delete().eq('id', id)
    setItems(items.filter(i => i.id !== id))
  }

  const openItemForm = (item = null) => {
    if (item) {
      setItemForm({ ...item, price: item.price.toString(), tags: item.tags || [] })
      setEditItem(item)
    } else {
      setItemForm({
        name: '', name_en: '', description: '', description_en: '',
        price: '', emoji: '🍽️', allergens: '', calories: '',
        prep_time: '', category_id: activeCategory || '', is_special: false, tags: []
      })
      setEditItem(null)
    }
    setShowItemForm(true)
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingImage(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('menu-images')
      .upload(path, file)
    if (!error) {
      const { data } = supabase.storage.from('menu-images').getPublicUrl(path)
      setItemForm(f => ({ ...f, image_url: data.publicUrl }))
    }
    setUploadingImage(false)
  }

  const saveItem = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...itemForm,
      price: parseFloat(itemForm.price),
      calories: itemForm.calories ? parseInt(itemForm.calories) : null,
      restaurant_id: restaurant.id,
    }
    if (editItem) {
      await supabase.from('menu_items').update(payload).eq('id', editItem.id)
      setItems(items.map(i => i.id === editItem.id ? { ...i, ...payload } : i))
    } else {
      const { data } = await supabase.from('menu_items').insert(payload).select().single()
      setItems([...items, data])
    }
    setSaving(false)
    setShowItemForm(false)
    setSaveMsg('Sačuvano!')
    setTimeout(() => setSaveMsg(''), 2000)
  }

  const addCategory = async () => {
    const name = prompt('Naziv kategorije:')
    if (!name) return
    const icon = prompt('Emoji ikona (npr. 🍕):', '🍽️')
    const { data } = await supabase.from('categories').insert({
      restaurant_id: restaurant.id,
      name, icon: icon || '🍽️',
      sort_order: categories.length
    }).select().single()
    setCategories([...categories, data])
    setActiveCategory(data.id)
  }

  const filteredItems = activeCategory
    ? items.filter(i => i.category_id === activeCategory)
    : items

  if (loading) return (
    <div style={{ padding: 40, color: '#8a9e96', fontFamily: 'DM Sans, sans-serif' }}>
      Učitavanje...
    </div>
  )

  return (
    <div className={styles.moduleWrap}>

      {/* Poruka o čuvanju */}
      {saveMsg && (
        <div className={styles.saveToast}>✓ {saveMsg}</div>
      )}

      {/* Tab navigacija */}
      <div className={styles.pageTabs}>
        {[
          { key: 'dashboard', label: 'Pregled', icon: '📊' },
          { key: 'menu',      label: 'Meni i stavke', icon: '🍽️' },
        ].map(tab => (
          <button
            key={tab.key}
            className={`${styles.pageTab} ${activePage === tab.key ? styles.pageTabActive : ''}`}
            onClick={() => setActivePage(tab.key)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.content}>

        {/* DASHBOARD */}
        {activePage === 'dashboard' && (
          <div>
            <div className={styles.metrics}>
              <div className={styles.metric}>
                <div className={styles.metricLabel}>Jela u meniju</div>
                <div className={styles.metricVal}>{items.filter(i => i.is_visible).length}</div>
                <div className={styles.metricSub}>od {items.length} ukupno</div>
              </div>
              <div className={styles.metric}>
                <div className={styles.metricLabel}>Kategorije</div>
                <div className={styles.metricVal}>{categories.length}</div>
              </div>
              <div className={styles.metric}>
                <div className={styles.metricLabel}>Vaš URL</div>
                <div className={styles.metricVal} style={{ fontSize: 14 }}>
                  smartmeni.me/{restaurant?.slug}
                </div>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardTitle}>Brzi start</div>
              {categories.length === 0 && (
                <div className={styles.startStep}>
                  <span className={styles.startNum}>1</span>
                  <div>
                    <div className={styles.startTitle}>Dodajte kategoriju menija</div>
                    <div className={styles.startDesc}>npr. Predjela, Riba, Meso, Piće...</div>
                  </div>
                  <button className={styles.startBtn} onClick={() => { setActivePage('menu'); addCategory() }}>
                    Dodaj →
                  </button>
                </div>
              )}
              {categories.length > 0 && items.length === 0 && (
                <div className={styles.startStep}>
                  <span className={styles.startNum}>2</span>
                  <div>
                    <div className={styles.startTitle}>Dodajte prvo jelo</div>
                    <div className={styles.startDesc}>Naziv, opis, cijena i slika</div>
                  </div>
                  <button className={styles.startBtn} onClick={() => { setActivePage('menu'); openItemForm() }}>
                    Dodaj →
                  </button>
                </div>
              )}
              {items.length > 0 && (
                <div className={styles.startStep}>
                  <span className={styles.startNum} style={{ background: '#e0f5ec', color: '#0d7a52' }}>✓</span>
                  <div>
                    <div className={styles.startTitle}>Meni je aktivan!</div>
                    <div className={styles.startDesc}>Gosti mogu skenirati QR kod</div>
                  </div>
                  <a href={`/${restaurant.slug}`} target="_blank" rel="noreferrer" className={styles.startBtn}>
                    Otvori →
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MENU */}
        {activePage === 'menu' && (
          <div>
            <div className={styles.menuTop}>
              <div className={styles.catTabs}>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    className={`${styles.catTab} ${activeCategory === cat.id ? styles.catTabActive : ''}`}
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    {cat.icon} {cat.name}
                  </button>
                ))}
                <button className={styles.catTabAdd} onClick={addCategory}>+ Kategorija</button>
              </div>
              <button className={styles.addItemBtn} onClick={() => openItemForm()}>
                + Dodaj jelo
              </button>
            </div>

            <div className={styles.card}>
              {filteredItems.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>🍽️</div>
                  <div className={styles.emptyTitle}>Nema stavki u ovoj kategoriji</div>
                  <button className={styles.emptyBtn} onClick={() => openItemForm()}>
                    + Dodaj prvo jelo
                  </button>
                </div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th></th>
                      <th>Naziv</th>
                      <th>Cijena</th>
                      <th>Status</th>
                      <th>Vidljivo</th>
                      <th>Akcije</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map(item => (
                      <tr key={item.id}>
                        <td>
                          <div className={styles.itemThumb}>
                            {item.image_url
                              ? <img src={item.image_url} alt={item.name} />
                              : <span>{item.emoji}</span>
                            }
                          </div>
                        </td>
                        <td>
                          <div className={styles.itemName}>{item.name}</div>
                          <div className={styles.itemDesc}>{item.description?.slice(0, 40)}...</div>
                        </td>
                        <td className={styles.itemPrice}>€{parseFloat(item.price).toFixed(2)}</td>
                        <td>
                          {item.is_special
                            ? <span className={`${styles.pill} ${styles.pillSpecial}`}>Dnevna ponuda</span>
                            : <span className={`${styles.pill} ${styles.pillActive}`}>Aktivno</span>
                          }
                        </td>
                        <td>
                          <button
                            className={`${styles.toggle} ${item.is_visible ? styles.toggleOn : styles.toggleOff}`}
                            onClick={() => toggleItemVisible(item)}
                          />
                        </td>
                        <td>
                          <button className={styles.actionBtn} onClick={() => openItemForm(item)}>Uredi</button>
                          <button className={styles.actionBtn} onClick={() => deleteItem(item.id)}>Briši</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* QR */}
        {activePage === 'qr' && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>Vaš QR kod i link</div>
            <div className={styles.qrSection}>
              <div className={styles.qrBox}>
                <div className={styles.qrPlaceholder}>
                  <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                    <rect x="2" y="2" width="26" height="26" rx="4" stroke="currentColor" strokeWidth="3" fill="none"/>
                    <rect x="10" y="10" width="10" height="10" rx="1" fill="currentColor"/>
                    <rect x="52" y="2" width="26" height="26" rx="4" stroke="currentColor" strokeWidth="3" fill="none"/>
                    <rect x="60" y="10" width="10" height="10" rx="1" fill="currentColor"/>
                    <rect x="2" y="52" width="26" height="26" rx="4" stroke="currentColor" strokeWidth="3" fill="none"/>
                    <rect x="10" y="60" width="10" height="10" rx="1" fill="currentColor"/>
                    <rect x="36" y="2" width="8" height="8" rx="1" fill="currentColor"/>
                    <rect x="36" y="36" width="8" height="8" rx="1" fill="currentColor"/>
                    <rect x="48" y="36" width="8" height="8" rx="1" fill="currentColor"/>
                    <rect x="60" y="36" width="8" height="8" rx="1" fill="currentColor"/>
                    <rect x="36" y="48" width="8" height="8" rx="1" fill="currentColor"/>
                    <rect x="48" y="62" width="8" height="8" rx="1" fill="currentColor"/>
                  </svg>
                </div>
                <div className={styles.qrLabel}>{restaurant?.name}</div>
              </div>
              <div className={styles.qrInfo}>
                <div className={styles.qrUrlLabel}>Link za goste</div>
                <div className={styles.qrUrl}>
                  <span>smartmeni.me/{restaurant?.slug}</span>
                  <button onClick={() => navigator.clipboard.writeText(`https://smartmeni.me/${restaurant?.slug}`)}>
                    Kopiraj
                  </button>
                </div>
                <p className={styles.qrNote}>
                  Odštampajte QR kod i zalijepite na svaki sto. Gosti skeniraju i meni se odmah otvara na telefonu.
                </p>
                <a
                  href={`/${restaurant?.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.viewBtn}
                >
                  Otvori meni →
                </a>
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {activePage === 'settings' && restaurant && (
          <SettingsPage restaurant={restaurant} setRestaurant={setRestaurant} />
        )}

      </div>

      {/* ITEM FORM MODAL */}
      {showItemForm && (
        <div className={styles.modalOverlay} onClick={() => setShowItemForm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>{editItem ? 'Uredi stavku' : 'Novo jelo ili piće'}</div>
              <button className={styles.modalClose} onClick={() => setShowItemForm(false)}>✕</button>
            </div>
            <form onSubmit={saveItem} className={styles.modalForm}>
              <div className={styles.modalGrid}>
                <div className={styles.field}>
                  <label>Naziv (SR) *</label>
                  <input value={itemForm.name} onChange={e => setItemForm(f => ({...f, name: e.target.value}))} required />
                </div>
                <div className={styles.field}>
                  <label>Naziv (EN)</label>
                  <input value={itemForm.name_en} onChange={e => setItemForm(f => ({...f, name_en: e.target.value}))} />
                </div>
                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <label>Opis (SR)</label>
                  <textarea value={itemForm.description} onChange={e => setItemForm(f => ({...f, description: e.target.value}))} rows={2} />
                </div>
                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <label>Opis (EN)</label>
                  <textarea value={itemForm.description_en} onChange={e => setItemForm(f => ({...f, description_en: e.target.value}))} rows={2} />
                </div>
                <div className={styles.field}>
                  <label>Cijena (€) *</label>
                  <input type="number" step="0.01" value={itemForm.price} onChange={e => setItemForm(f => ({...f, price: e.target.value}))} required />
                </div>
                <div className={styles.field}>
                  <label>Emoji ikona</label>
                  <input value={itemForm.emoji} onChange={e => setItemForm(f => ({...f, emoji: e.target.value}))} />
                </div>
                <div className={styles.field}>
                  <label>Kategorija</label>
                  <select value={itemForm.category_id} onChange={e => setItemForm(f => ({...f, category_id: e.target.value}))}>
                    <option value="">-- Odaberi --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Vrijeme pripreme</label>
                  <input placeholder="npr. 15 min" value={itemForm.prep_time} onChange={e => setItemForm(f => ({...f, prep_time: e.target.value}))} />
                </div>
                <div className={styles.field}>
                  <label>Alergeni</label>
                  <input placeholder="npr. Gluten, Mlijeko" value={itemForm.allergens} onChange={e => setItemForm(f => ({...f, allergens: e.target.value}))} />
                </div>
                <div className={styles.field}>
                  <label>Kalorije</label>
                  <input type="number" placeholder="npr. 320" value={itemForm.calories} onChange={e => setItemForm(f => ({...f, calories: e.target.value}))} />
                </div>
                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <label>Slika jela</label>
                  {itemForm.image_url && (
                    <img src={itemForm.image_url} alt="preview" className={styles.imgPreview} />
                  )}
                  <input type="file" accept="image/*" onChange={handleImageUpload} />
                  {uploadingImage && <span style={{fontSize:12,color:'#8a9e96'}}>Upload u toku...</span>}
                </div>
                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <label className={styles.checkLabel}>
                    <input type="checkbox" checked={itemForm.is_special} onChange={e => setItemForm(f => ({...f, is_special: e.target.checked}))} />
                    Prikaži kao dnevnu ponudu
                  </label>
                </div>
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnCancel} onClick={() => setShowItemForm(false)}>Odustani</button>
                <button type="submit" className={styles.btnSave} disabled={saving}>
                  {saving ? 'Čuvanje...' : 'Sačuvaj stavku'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function SettingsPage({ restaurant, setRestaurant }) {
  const [form, setForm] = useState({ ...restaurant })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    await supabase.from('restaurants').update(form).eq('id', restaurant.id)
    setRestaurant(form)
    setSaving(false)
    setMsg('Sačuvano!')
    setTimeout(() => setMsg(''), 2000)
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>Podaci o restoranu</div>
      <form onSubmit={save} className={styles.settingsForm}>
        <div className={styles.modalGrid}>
          <div className={styles.field}>
            <label>Naziv restorana</label>
            <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
          </div>
          <div className={styles.field}>
            <label>Lokacija</label>
            <input value={form.location || ''} onChange={e => setForm(f => ({...f, location: e.target.value}))} />
          </div>
          <div className={styles.field}>
            <label>Telefon</label>
            <input value={form.phone || ''} onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
          </div>
          <div className={styles.field}>
            <label>Radno vrijeme</label>
            <input value={form.hours || ''} onChange={e => setForm(f => ({...f, hours: e.target.value}))} />
          </div>
          <div className={`${styles.field} ${styles.fullWidth}`}>
            <label>Boja brenda (hex)</label>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <input type="color" value={form.color || '#0d7a52'} onChange={e => setForm(f => ({...f, color: e.target.value}))} style={{width:40,height:36,padding:2,border:'1px solid #d0e4dc',borderRadius:8}} />
              <input value={form.color || '#0d7a52'} onChange={e => setForm(f => ({...f, color: e.target.value}))} style={{flex:1}} />
            </div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12,marginTop:8}}>
          <button type="submit" className={styles.btnSave} disabled={saving}>
            {saving ? 'Čuvanje...' : 'Sačuvaj promjene'}
          </button>
          {msg && <span style={{color:'#0d7a52',fontSize:13}}>✓ {msg}</span>}
        </div>
      </form>

      {/* Poruke za poziv konobara */}
      <WaiterMessagesEditor restaurant={restaurant} setRestaurant={setRestaurant} />
    </div>
  )
}

function WaiterMessagesEditor({ restaurant, setRestaurant }) {
  const DEFAULT_MESSAGES = [
    { sr: 'Pozovi konobara', en: 'Call waiter', icon: '🔔' },
    { sr: 'Donesi račun', en: 'Bring the bill', icon: '🧾' },
    { sr: 'Donesi vodu', en: 'Bring water', icon: '🥤' },
    { sr: 'Skloni prazne tanjire', en: 'Clear the table', icon: '🍽️' },
  ]

  const [messages, setMessages] = useState(
    restaurant.waiter_messages || DEFAULT_MESSAGES
  )
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const ICONS = ['🔔','🧾','🥤','🍽️','☕','🍷','🧂','❓','👋','🛎️']

  const update = (i, field, val) => {
    setMessages(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m))
  }

  const add = () => {
    setMessages(prev => [...prev, { sr: '', en: '', icon: '🔔' }])
  }

  const remove = (i) => {
    setMessages(prev => prev.filter((_, idx) => idx !== i))
  }

  const save = async () => {
    setSaving(true)
    await supabase.from('restaurants').update({ waiter_messages: messages }).eq('id', restaurant.id)
    setRestaurant(r => ({ ...r, waiter_messages: messages }))
    setSaving(false)
    setMsg('Sačuvano!')
    setTimeout(() => setMsg(''), 2000)
  }

  return (
    <div className={styles.card} style={{ marginTop: 16 }}>
      <div className={styles.cardTitle}>Poruke za poziv konobara</div>
      <div style={{ fontSize: 12, color: '#8a9e96', marginBottom: 14 }}>
        Gosti biraju jednu od ovih poruka kada pozivaju konobara.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={m.icon}
              onChange={e => update(i, 'icon', e.target.value)}
              style={{ width: 54, padding: '7px 4px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 18, textAlign: 'center' }}
            >
              {ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
            </select>
            <input
              value={m.sr}
              onChange={e => update(i, 'sr', e.target.value)}
              placeholder="Tekst (SR)"
              style={{ flex: 1, padding: '8px 10px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
            />
            <input
              value={m.en}
              onChange={e => update(i, 'en', e.target.value)}
              placeholder="Text (EN)"
              style={{ flex: 1, padding: '8px 10px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
            />
            <button
              onClick={() => remove(i)}
              style={{ padding: '7px 10px', background: 'transparent', border: '1px solid #f5b0b0', borderRadius: 8, color: '#c0392b', cursor: 'pointer', fontSize: 13 }}
            >✕</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
        <button
          onClick={add}
          style={{ padding: '8px 14px', background: '#f0f5f2', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
        >
          + Dodaj poruku
        </button>
        <button onClick={save} className={styles.btnSave} disabled={saving}>
          {saving ? 'Čuvanje...' : 'Sačuvaj poruke'}
        </button>
        {msg && <span style={{ color: '#0d7a52', fontSize: 13 }}>✓ {msg}</span>}
      </div>
    </div>
  )
}
