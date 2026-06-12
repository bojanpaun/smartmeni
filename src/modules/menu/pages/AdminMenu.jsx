import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import { stripAccountFields } from '../../../lib/planUtils'
import { translateContent, menuItemFields } from '../../../lib/contentTranslate'
import RecipeLibraryPicker from '../components/RecipeLibraryPicker'
import MenuItemTranslations from '../components/MenuItemTranslations'
import styles from './AdminMenu.module.css'
import gsStyles from './GeneralSettings.module.css'

// Kurirani emoji izbor za ikonu stavke (umjesto slobodnog unosa teksta).
const EMOJI_OPTIONS = [
  '🍽️','🍕','🍔','🍟','🌭','🥪','🌮','🌯','🥙','🧆','🥗','🍝','🍜','🍲','🍛','🥘',
  '🍣','🍱','🍳','🥩','🍗','🍖','🥓','🧀','🥖','🥐','🥨','🥞','🧇','🍰','🧁','🍮',
  '🍩','🍪','🍦','🍨','🍧','🍫','🍿','🥜','🍅','🥑','🍋','🍓','🍑','🍉',
  '☕','🍵','🧃','🥤','🧋','🍺','🍻','🍷','🥂','🍸','🍹','🍾','🥃','🍶','🧉','🥛',
]

export default function AdminMenu() {
  const { t } = useTranslation('admin')
  const navigate = useNavigate()
  const { user, restaurant: ctxRestaurant } = usePlatform()

  const [restaurant, setRestaurant] = useState(ctxRestaurant)
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [activePage, setActivePage] = useState('menu')
  const [activeCategory, setActiveCategory] = useState(null)

  const [showItemForm, setShowItemForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [transItem, setTransItem] = useState(null) // jelo čiji editor prevoda je otvoren
  const [itemForm, setItemForm] = useState({
    name: '', name_en: '', description: '', description_en: '',
    price: '', emoji: '🍽️', allergens: '', calories: '',
    prep_time: '', category_id: '', is_special: false, tags: []
  })
  const [uploadingImage, setUploadingImage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [showLibrary, setShowLibrary] = useState(false)
  const [catForm, setCatForm] = useState({ name: '', icon: '', description: '' })
  const [editingCat, setEditingCat] = useState(false)

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
    if (!confirm(t('amConfirmDeleteItem'))) return
    await supabase.from('menu_items').delete().eq('id', id)
    setItems(items.filter(i => i.id !== id))
  }

  const openItemForm = (item = null) => {
    if (item) {
      setItemForm({ ...item, price: item.price.toString(), tags: item.tags || [] })
      setEditItem(item)
    } else {
      setItemForm({
        name: '', description: '',
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
    let savedId = editItem?.id
    if (editItem) {
      await supabase.from('menu_items').update(payload).eq('id', editItem.id)
      setItems(items.map(i => i.id === editItem.id ? { ...i, ...payload } : i))
    } else {
      const { data } = await supabase.from('menu_items').insert(payload).select().single()
      savedId = data?.id
      setItems([...items, data])
    }
    // Fire-and-forget AI prevod naziva/opisa na 6 jezika (ne blokira UI; edge
    // preskače svjež/override). Greške tihe — fallback na izvor u GuestMenu.
    if (savedId) {
      translateContent(restaurant.id, menuItemFields({ id: savedId, name: payload.name, description: payload.description }))
        .catch(() => {})
    }
    setSaving(false)
    setShowItemForm(false)
    setSaveMsg(t('saved'))
    setTimeout(() => setSaveMsg(''), 2000)
  }

  const addCategory = async () => {
    const name = prompt(t('amPromptCatName'))
    if (!name) return
    const icon = prompt(t('amPromptCatIcon'), '🍽️')
    const { data } = await supabase.from('categories').insert({
      restaurant_id: restaurant.id,
      name, icon: icon || '🍽️',
      sort_order: categories.length
    }).select().single()
    setCategories([...categories, data])
    setActiveCategory(data.id)
    if (data?.id) {
      translateContent(restaurant.id, [{ entity_type: 'category', entity_id: data.id, field: 'name', text: name }]).catch(() => {})
    }
  }

  const startEditCategory = (cat) => {
    setCatForm({ name: cat.name, icon: cat.icon || '🍽️', description: cat.description || '' })
    setEditingCat(true)
  }

  const saveCategoryEdit = async (cat) => {
    const name = catForm.name.trim()
    if (!name) return
    const payload = { name, icon: catForm.icon || '🍽️', description: catForm.description.trim() || null }
    await supabase.from('categories').update(payload).eq('id', cat.id).eq('restaurant_id', restaurant.id)
    setCategories(categories.map(c => c.id === cat.id ? { ...c, ...payload } : c))
    setEditingCat(false)
    translateContent(restaurant.id, [{ entity_type: 'category', entity_id: cat.id, field: 'name', text: name }]).catch(() => {})
  }

  const deleteCategory = async (cat) => {
    const itemCount = items.filter(i => i.category_id === cat.id).length
    const msg = itemCount > 0
      ? t('amConfirmDeleteCatItems', { name: cat.name, count: itemCount })
      : t('amConfirmDeleteCat', { name: cat.name })
    if (!confirm(msg)) return
    // menu_items.category_id ima ON DELETE CASCADE — stavke u kategoriji se brišu zajedno.
    await supabase.from('categories').delete().eq('id', cat.id).eq('restaurant_id', restaurant.id)
    const remaining = categories.filter(c => c.id !== cat.id)
    setCategories(remaining)
    setItems(items.filter(i => i.category_id !== cat.id))
    setActiveCategory(remaining[0]?.id || null)
  }

  const filteredItems = activeCategory
    ? items.filter(i => i.category_id === activeCategory)
    : items

  if (loading) return (
    <div style={{ padding: 40, color: '#8a9e96', fontFamily: 'DM Sans, sans-serif' }}>
      {t('loading')}
    </div>
  )

  return (
    <div className={styles.moduleWrap}>

      {showLibrary && (
        <RecipeLibraryPicker
          categories={categories}
          defaultCategoryId={activeCategory}
          onClose={() => setShowLibrary(false)}
          onImported={() => restaurant && loadData(restaurant.id)}
        />
      )}

      {/* Poruka o čuvanju */}
      {saveMsg && (
        <div className={styles.saveToast}>✓ {saveMsg}</div>
      )}

      <div className={gsStyles.page} style={{ maxWidth: 960 }}>
        <div className={gsStyles.header}>
          <h1 className={gsStyles.title}>{t('navMenuEdit')}</h1>
          <p className={gsStyles.subtitle}>{t('amSubtitle')}</p>
        </div>

        {/* DASHBOARD */}
        {activePage === 'dashboard' && (
          <div>
            <div className={styles.metrics}>
              <div className={styles.metric}>
                <div className={styles.metricLabel}>{t('amMetricDishes')}</div>
                <div className={styles.metricVal}>{items.filter(i => i.is_visible).length}</div>
                <div className={styles.metricSub}>{t('amMetricOf', { total: items.length })}</div>
              </div>
              <div className={styles.metric}>
                <div className={styles.metricLabel}>{t('amCategories')}</div>
                <div className={styles.metricVal}>{categories.length}</div>
              </div>
              <div className={styles.metric}>
                <div className={styles.metricLabel}>{t('amMetricUrl')}</div>
                <div className={styles.metricVal} style={{ fontSize: 14 }}>
                  restby.me/{restaurant?.slug}
                </div>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardTitle}>{t('amQuickStart')}</div>
              {categories.length === 0 && (
                <div className={styles.startStep}>
                  <span className={styles.startNum}>1</span>
                  <div>
                    <div className={styles.startTitle}>{t('amStep1Title')}</div>
                    <div className={styles.startDesc}>{t('amStep1Desc')}</div>
                  </div>
                  <button className={styles.startBtn} onClick={() => { setActivePage('menu'); addCategory() }}>
                    {t('add')} →
                  </button>
                </div>
              )}
              {categories.length > 0 && items.length === 0 && (
                <div className={styles.startStep}>
                  <span className={styles.startNum}>2</span>
                  <div>
                    <div className={styles.startTitle}>{t('amStep2Title')}</div>
                    <div className={styles.startDesc}>{t('amStep2Desc')}</div>
                  </div>
                  <button className={styles.startBtn} onClick={() => { setActivePage('menu'); openItemForm() }}>
                    {t('add')} →
                  </button>
                </div>
              )}
              {items.length > 0 && (
                <div className={styles.startStep}>
                  <span className={styles.startNum} style={{ background: '#e0f5ec', color: '#0d7a52' }}>✓</span>
                  <div>
                    <div className={styles.startTitle}>{t('amStep3Title')}</div>
                    <div className={styles.startDesc}>{t('amStep3Desc')}</div>
                  </div>
                  <a href={`/${restaurant.slug}`} target="_blank" rel="noreferrer" className={styles.startBtn}>
                    {t('amOpenArrow')}
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
                    {cat.is_bar && <span className={styles.barBadge}>{t('navBar')}</span>}
                  </button>
                ))}
                <button className={styles.catTabAdd} onClick={addCategory}>+ {t('amCategory')}</button>
              </div>
              <div className={styles.menuTopActions}>
                <button className={styles.libraryBtn} onClick={() => setShowLibrary(true)}>
                  📚 {t('amLibrary')}
                </button>
                <button className={styles.addItemBtn} onClick={() => openItemForm()}>
                  + {t('amAddDish')}
                </button>
              </div>
            </div>
            {activeCategory && (() => {
              const cat = categories.find(c => c.id === activeCategory)
              if (!cat) return null
              const toggleBar = async () => {
                const next = !cat.is_bar
                await supabase.from('categories').update({ is_bar: next }).eq('id', cat.id)
                setCategories(categories.map(c => c.id === cat.id ? { ...c, is_bar: next } : c))
              }
              return (
                <div className={styles.catSettings}>
                  {editingCat ? (
                    <div className={styles.catEditBox}>
                      <div className={styles.catEditRow}>
                        <select
                          className={styles.catIconSelect}
                          value={catForm.icon}
                          onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))}
                        >
                          {EMOJI_OPTIONS.map(em => <option key={em} value={em}>{em}</option>)}
                        </select>
                        <input
                          className={styles.catNameInput}
                          value={catForm.name}
                          autoFocus
                          onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && saveCategoryEdit(cat)}
                          placeholder={t('amCatNamePlaceholder')}
                        />
                        <button className={styles.catSaveBtn} onClick={() => saveCategoryEdit(cat)}>{t('save')}</button>
                        <button className={styles.catCancelBtn} onClick={() => setEditingCat(false)}>{t('cancel')}</button>
                      </div>
                      <textarea
                        className={styles.catDescInput}
                        value={catForm.description}
                        onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))}
                        placeholder={t('amCatNotePlaceholder')}
                        rows={2}
                      />
                    </div>
                  ) : (
                    <div className={styles.catEditRow}>
                      <button className={styles.catRenameBtn} onClick={() => startEditCategory(cat)}>
                        ✏️ {t('amEditCategory')}
                      </button>
                      {cat.description && (
                        <span className={styles.catNote}>📝 {cat.description}</span>
                      )}
                    </div>
                  )}
                  <div className={styles.catSettingsRight}>
                    <label className={styles.catToggleLabel}>
                      <input type="checkbox" checked={!!cat.is_bar} onChange={toggleBar} />
                      <span>🍷 {t('amBarCategory')}</span>
                      <span className={styles.catToggleHint}>{t('amBarCategoryHint')}</span>
                    </label>
                    <button className={styles.catDeleteBtn} onClick={() => deleteCategory(cat)}>
                      🗑 {t('amDeleteCategory')}
                    </button>
                  </div>
                </div>
              )
            })()}

            <div className={styles.card}>
              {filteredItems.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>🍽️</div>
                  <div className={styles.emptyTitle}>{t('amNoItems')}</div>
                  <button className={styles.emptyBtn} onClick={() => openItemForm()}>
                    + {t('amAddFirstDish')}
                  </button>
                </div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th></th>
                      <th>{t('thName')}</th>
                      <th>{t('thPrice')}</th>
                      <th>{t('thStatus')}</th>
                      <th>{t('thVisible')}</th>
                      <th>{t('thActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map(item => (
                      <tr key={item.id}>
                        <td>
                          <div className={styles.itemThumb}>
                            {item.image_url
                              ? <img src={item.image_url} alt={item.name} loading="lazy" decoding="async" />
                              : <span>{item.emoji}</span>
                            }
                          </div>
                        </td>
                        <td>
                          <div className={styles.itemName}>{item.name}</div>
                          {item.description && <div className={styles.itemDesc}>{item.description.slice(0, 40)}…</div>}
                          {/* Mobilni: cijena + status + vidljivost ispod naziva (kolone skrivene) */}
                          <div className={styles.mobileInfo}>
                            <span className={styles.itemPrice}>€{parseFloat(item.price).toFixed(2)}</span>
                            {item.is_special
                              ? <span className={`${styles.pill} ${styles.pillSpecial}`}>{t('amDailySpecial')}</span>
                              : <span className={`${styles.pill} ${styles.pillActive}`}>{t('amActive')}</span>}
                            <button
                              className={`${styles.toggle} ${item.is_visible ? styles.toggleOn : styles.toggleOff}`}
                              onClick={() => toggleItemVisible(item)}
                              title={t('amVisibleToGuests')}
                            />
                          </div>
                        </td>
                        <td className={styles.itemPrice}>€{parseFloat(item.price).toFixed(2)}</td>
                        <td>
                          {item.is_special
                            ? <span className={`${styles.pill} ${styles.pillSpecial}`}>{t('amDailySpecial')}</span>
                            : <span className={`${styles.pill} ${styles.pillActive}`}>{t('amActive')}</span>
                          }
                        </td>
                        <td>
                          <button
                            className={`${styles.toggle} ${item.is_visible ? styles.toggleOn : styles.toggleOff}`}
                            onClick={() => toggleItemVisible(item)}
                          />
                        </td>
                        <td>
                          <button className={styles.actionBtn} onClick={() => openItemForm(item)}>{t('amEdit')}</button>
                          <button className={styles.actionBtn} onClick={() => setTransItem(item)} title={t('amTransTitle')}>🌐</button>
                          <button className={styles.actionBtn} onClick={() => deleteItem(item.id)}>{t('amDelete')}</button>
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
            <div className={styles.cardTitle}>{t('amQrTitle')}</div>
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
                <div className={styles.qrUrlLabel}>{t('amLinkForGuests')}</div>
                <div className={styles.qrUrl}>
                  <span>restby.me/{restaurant?.slug}</span>
                  <button onClick={() => navigator.clipboard.writeText(`https://restby.me/${restaurant?.slug}`)}>
                    {t('amCopy')}
                  </button>
                </div>
                <p className={styles.qrNote}>
                  {t('amQrNote')}
                </p>
                <a
                  href={`/${restaurant?.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.viewBtn}
                >
                  {t('amOpenMenu')}
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
              <div className={styles.modalTitle}>{editItem ? t('amEditItem') : t('amNewItem')}</div>
              <button className={styles.modalClose} onClick={() => setShowItemForm(false)}>✕</button>
            </div>
            <form onSubmit={saveItem} className={styles.modalForm}>
              <div className={styles.modalGrid}>
                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <label>{t('fName')} *</label>
                  <input value={itemForm.name} onChange={e => setItemForm(f => ({...f, name: e.target.value}))} required />
                </div>
                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <label>{t('fDesc')}</label>
                  <textarea value={itemForm.description} onChange={e => setItemForm(f => ({...f, description: e.target.value}))} rows={2} />
                </div>
                <div className={`${styles.field} ${styles.fullWidth}`} style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: -4 }}>
                  {t('amTransAutoNote')}
                </div>
                <div className={styles.field}>
                  <label>{t('amPriceLabel')} *</label>
                  <input type="number" step="0.01" value={itemForm.price} onChange={e => setItemForm(f => ({...f, price: e.target.value}))} required />
                </div>
                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <label>{t('amItemIcon')} <span className={styles.fieldHintInline}>{t('amItemIconHint')}</span></label>
                  <div className={styles.emojiPicker}>
                    {EMOJI_OPTIONS.map(em => (
                      <button
                        type="button"
                        key={em}
                        className={`${styles.emojiOpt} ${itemForm.emoji === em ? styles.emojiOptActive : ''}`}
                        onClick={() => setItemForm(f => ({ ...f, emoji: em }))}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.field}>
                  <label>{t('amCategory')}</label>
                  <select value={itemForm.category_id} onChange={e => setItemForm(f => ({...f, category_id: e.target.value}))}>
                    <option value="">{t('amChoose')}</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>{t('amPrepTime')}</label>
                  <input placeholder={t('amPrepPlaceholder')} value={itemForm.prep_time} onChange={e => setItemForm(f => ({...f, prep_time: e.target.value}))} />
                </div>
                <div className={styles.field}>
                  <label>{t('amAllergens')}</label>
                  <input placeholder={t('amAllergensPlaceholder')} value={itemForm.allergens} onChange={e => setItemForm(f => ({...f, allergens: e.target.value}))} />
                </div>
                <div className={styles.field}>
                  <label>{t('amCalories')}</label>
                  <input type="number" placeholder={t('amCaloriesPlaceholder')} value={itemForm.calories} onChange={e => setItemForm(f => ({...f, calories: e.target.value}))} />
                </div>
                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <label>{t('amDishImage')}</label>
                  {itemForm.image_url && (
                    <img src={itemForm.image_url} alt="preview" className={styles.imgPreview} />
                  )}
                  <input type="file" accept="image/*" onChange={handleImageUpload} />
                  {uploadingImage && <span style={{fontSize:12,color:'#8a9e96'}}>{t('amUploadInProgress')}</span>}
                </div>
                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <label className={styles.checkLabel}>
                    <input type="checkbox" checked={itemForm.is_special} onChange={e => setItemForm(f => ({...f, is_special: e.target.checked}))} />
                    {t('amShowAsDaily')}
                  </label>
                </div>
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnCancel} onClick={() => setShowItemForm(false)}>{t('cancel')}</button>
                <button type="submit" className={styles.btnSave} disabled={saving}>
                  {saving ? t('saving') : t('amSaveItem')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {transItem && restaurant && (
        <MenuItemTranslations item={transItem} restaurantId={restaurant.id} onClose={() => setTransItem(null)} />
      )}
    </div>
  )
}

function SettingsPage({ restaurant, setRestaurant }) {
  const { t } = useTranslation('admin')
  const [form, setForm] = useState({ ...restaurant })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    // Boja brenda se uređuje u Postavke → Brend (kanonski izvor) — ne diraj je odavde.
    const { color, ...rest } = form
    await supabase.from('restaurants').update(stripAccountFields(rest)).eq('id', restaurant.id)
    setRestaurant({ ...restaurant, ...rest })
    setSaving(false)
    setMsg(t('saved'))
    setTimeout(() => setMsg(''), 2000)
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>{t('amRestaurantData')}</div>
      <form onSubmit={save} className={styles.settingsForm}>
        <div className={styles.modalGrid}>
          <div className={styles.field}>
            <label>{t('amRestaurantName')}</label>
            <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
          </div>
          <div className={styles.field}>
            <label>{t('amLocation')}</label>
            <input value={form.location || ''} onChange={e => setForm(f => ({...f, location: e.target.value}))} />
          </div>
          <div className={styles.field}>
            <label>{t('amPhone')}</label>
            <input value={form.phone || ''} onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
          </div>
          <div className={styles.field}>
            <label>{t('amHours')}</label>
            <input value={form.hours || ''} onChange={e => setForm(f => ({...f, hours: e.target.value}))} />
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12,marginTop:8}}>
          <button type="submit" className={styles.btnSave} disabled={saving}>
            {saving ? t('saving') : t('amSaveChanges')}
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
  const { t } = useTranslation('admin')
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
    setMsg(t('saved'))
    setTimeout(() => setMsg(''), 2000)
  }

  return (
    <div className={styles.card} style={{ marginTop: 16 }}>
      <div className={styles.cardTitle}>{t('amWaiterMsgTitle')}</div>
      <div style={{ fontSize: 12, color: '#8a9e96', marginBottom: 14 }}>
        {t('amWaiterMsgHint')}
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
              placeholder={`${t('amTextField')} (SR)`}
              style={{ flex: 1, padding: '8px 10px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
            />
            <input
              value={m.en}
              onChange={e => update(i, 'en', e.target.value)}
              placeholder={`${t('amTextField')} (EN)`}
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
          + {t('amAddMessage')}
        </button>
        <button onClick={save} className={styles.btnSave} disabled={saving}>
          {saving ? t('saving') : t('amSaveMessages')}
        </button>
        {msg && <span style={{ color: '#0d7a52', fontSize: 13 }}>✓ {msg}</span>}
      </div>
    </div>
  )
}
