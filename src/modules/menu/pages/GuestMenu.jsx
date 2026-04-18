import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { getTemplate } from '../../../lib/templates'
import styles from './GuestMenu.module.css'

const DEMO_DATA = {
  restaurant: {
    name: 'Restoran Ribar',
    location: 'Budva, Crna Gora',
    rating: '4.9',
    hours: '10:00 – 23:00',
    table: 'Sto 4',
    color: '#0d7a52',
  },
  categories: [
    { id: 'predjela', label: 'Predjela', icon: '🥗' },
    { id: 'riba', label: 'Riba', icon: '🐟' },
    { id: 'meso', label: 'Meso', icon: '🥩' },
    { id: 'pizza', label: 'Pizza', icon: '🍕' },
    { id: 'pice', label: 'Piće', icon: '🍷' },
    { id: 'desert', label: 'Desert', icon: '🍮' },
  ],
  items: {
    predjela: [
      { id: 1, emoji: '🥗', bg: '#e0f5ec', name: 'Grčka salata', nameEn: 'Greek Salad', desc: 'Feta sir, masline, krastavac, crveni luk, paradajz', descEn: 'Feta cheese, olives, cucumber, red onion, tomato', price: '4.50', tags: ['veg', 'popular'], cal: 210, allergens: 'Mlijeko', time: '5 min', special: false },
      { id: 2, emoji: '🦑', bg: '#faeee8', name: 'Lignje na žaru', nameEn: 'Grilled Calamari', desc: 'Mediteranske lignje sa začinskim biljem i limunom', descEn: 'Mediterranean calamari with herbs and lemon', price: '8.00', tags: ['popular'], cal: 280, allergens: 'Mekušci', time: '12 min', special: true },
      { id: 3, emoji: '🧀', bg: '#faeeda', name: 'Kajmak sa hljebom', nameEn: 'Kaymak with bread', desc: 'Domaći kajmak, ajvar, maslinovo ulje, svježi hljeb', descEn: 'Homemade kaymak, ajvar, olive oil, fresh bread', price: '3.50', tags: ['veg'], cal: 320, allergens: 'Gluten, Mlijeko', time: '3 min', special: false },
      { id: 4, emoji: '🍅', bg: '#fceae8', name: 'Bruschetta', nameEn: 'Bruschetta', desc: 'Pečeni hljeb, paradajz, bosiljak, bijeli luk', descEn: 'Toasted bread, tomato, basil, garlic', price: '4.00', tags: ['veg', 'new'], cal: 180, allergens: 'Gluten', time: '5 min', special: false },
    ],
    riba: [
      { id: 5, emoji: '🐟', bg: '#e8f0fa', name: 'Brancin na žaru', nameEn: 'Grilled Sea Bass', desc: 'Cijeli brancin, roštilj, limun, kapar, maslinovo ulje', descEn: 'Whole sea bass, grill, lemon, capers, olive oil', price: '16.00', tags: ['popular'], cal: 380, allergens: 'Riba', time: '18 min', special: false },
      { id: 6, emoji: '🦐', bg: '#faeee8', name: 'Škampi buzara', nameEn: 'Scampi Buzara', desc: 'Svježi škampi u paradajz sosu sa češnjakom i vinom', descEn: 'Fresh scampi in tomato sauce with garlic and wine', price: '18.00', tags: ['popular', 'spicy'], cal: 310, allergens: 'Riba, Školjke', time: '15 min', special: true },
      { id: 7, emoji: '🐙', bg: '#eeedf8', name: 'Hobotnica sa krumpirom', nameEn: 'Octopus with potatoes', desc: 'Pečena hobotnica, krompir, maslinovo ulje, peršun', descEn: 'Baked octopus, potatoes, olive oil, parsley', price: '14.00', tags: [], cal: 420, allergens: 'Mekušci', time: '20 min', special: false },
    ],
    meso: [
      { id: 8, emoji: '🥩', bg: '#faeee8', name: 'Teleći medaljoni', nameEn: 'Veal Medallions', desc: 'Sa gljivama, kremastim sosom i pečenim povrćem', descEn: 'With mushrooms, creamy sauce and roasted vegetables', price: '15.00', tags: ['popular'], cal: 520, allergens: 'Mlijeko', time: '20 min', special: false },
      { id: 9, emoji: '🍗', bg: '#faeeda', name: 'Piletina na žaru', nameEn: 'Grilled Chicken', desc: 'Marinirani file, grillovano povrće, salata', descEn: 'Marinated fillet, grilled vegetables, salad', price: '10.00', tags: [], cal: 410, allergens: '', time: '15 min', special: false },
    ],
    pizza: [
      { id: 10, emoji: '🍕', bg: '#faeee8', name: 'Margherita', nameEn: 'Margherita', desc: 'Paradajz sos, mocarela, svježi bosiljak', descEn: 'Tomato sauce, mozzarella, fresh basil', price: '7.00', tags: ['veg'], cal: 680, allergens: 'Gluten, Mlijeko', time: '12 min', special: false },
      { id: 11, emoji: '🍕', bg: '#e0f5ec', name: 'Quattro stagioni', nameEn: 'Quattro Stagioni', desc: 'Šunka, masline, artičoka, pečurke', descEn: 'Ham, olives, artichoke, mushrooms', price: '9.50', tags: [], cal: 820, allergens: 'Gluten, Mlijeko', time: '12 min', special: false },
    ],
    pice: [
      { id: 12, emoji: '🍷', bg: '#eeedf8', name: 'Vranac Pro Corde', nameEn: 'Vranac Pro Corde', desc: 'Crno vino, Plantaže, Podgorica', descEn: 'Red wine, Plantaže, Podgorica', price: '5.00', tags: [], cal: 120, allergens: 'Sumpor', time: 'odmah', special: false },
      { id: 13, emoji: '🍺', bg: '#faeeda', name: 'Nikšičko tamno', nameEn: 'Nikšičko Dark Beer', desc: 'Domaće tamno pivo, 0.5l', descEn: 'Local dark beer, 0.5l', price: '2.50', tags: ['popular'], cal: 210, allergens: 'Gluten', time: 'odmah', special: false },
      { id: 14, emoji: '🥂', bg: '#e0f5ec', name: 'Prosecco', nameEn: 'Prosecco', desc: 'Pjenušavo vino, čaša', descEn: 'Sparkling wine, glass', price: '4.00', tags: [], cal: 90, allergens: 'Sumpor', time: 'odmah', special: false },
    ],
    desert: [
      { id: 15, emoji: '🍮', bg: '#faeeda', name: 'Crème brûlée', nameEn: 'Crème brûlée', desc: 'Klasični francuski desert sa karamelizovanim šećerom', descEn: 'Classic French dessert with caramelized sugar', price: '4.50', tags: ['popular'], cal: 380, allergens: 'Jaja, Mlijeko', time: 'odmah', special: false },
      { id: 16, emoji: '🍫', bg: '#fceae8', name: 'Čokoladna torta', nameEn: 'Chocolate Cake', desc: 'Topla čokoladna torta sa sladoledom od vanile', descEn: 'Warm chocolate cake with vanilla ice cream', price: '5.00', tags: ['new'], cal: 480, allergens: 'Gluten, Jaja, Mlijeko', time: '8 min', special: false },
    ],
  }
}

const TAG_CONFIG = {
  popular: { label: 'Popularno', labelEn: 'Popular', bg: '#e0f5ec', color: '#0d7a52' },
  veg: { label: 'Vegeterijansko', labelEn: 'Vegetarian', bg: '#eaf3de', color: '#3b6d11' },
  spicy: { label: 'Ljuto', labelEn: 'Spicy', bg: '#faeee8', color: '#7a3d1a' },
  new: { label: 'Novo', labelEn: 'New', bg: '#eeedf8', color: '#3c3489' },
}

export default function Menu() {
  const { slug } = useParams()
  const [activeCat, setActiveCat] = useState('predjela')
  const [selectedItem, setSelectedItem] = useState(null)
  const [lang, setLang] = useState('sr')
  const [waiterSent, setWaiterSent] = useState(false)
  const [showWaiter, setShowWaiter] = useState(false)
  const [realData, setRealData] = useState(null)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (!slug || slug === 'demo') { setLoadingData(false); return }
    const load = async () => {
      const { data: rest } = await supabase
        .from('restaurants').select('*').eq('slug', slug).single()
      if (!rest) { setLoadingData(false); return }
      const { data: cats } = await supabase
        .from('categories').select('*').eq('restaurant_id', rest.id).order('sort_order')
      const { data: its } = await supabase
        .from('menu_items').select('*')
        .eq('restaurant_id', rest.id).eq('is_visible', true).order('sort_order')
      setRealData({ restaurant: rest, categories: cats || [], items: its || [] })
      if (cats?.length) setActiveCat(cats[0].id)
      setLoadingData(false)
    }
    load()
  }, [slug])

  const isDemo = !slug || slug === 'demo' || !realData
  const data = isDemo ? DEMO_DATA : null
  const r = isDemo ? data.restaurant : realData?.restaurant
  const tpl = getTemplate(r?.template)
  const digitalOrdering = isDemo ? true : (r?.digital_ordering ?? true)
  const currentCategories = isDemo ? data.categories : realData?.categories || []
  const allItems = isDemo
    ? Object.values(data.items).flat()
    : realData?.items || []
  const items = isDemo
    ? (data.items[activeCat] || [])
    : allItems.filter(i => i.category_id === activeCat)
  const isEn = lang === 'en'
  const specialItem = allItems.find(i => isDemo ? i.special : i.is_special)

  const sendWaiterRequest = async (type) => {
    if (!isDemo && realData?.restaurant) {
      await supabase.from('waiter_requests').insert({
        restaurant_id: realData.restaurant.id,
        table_number: 'Sto',
        request_type: type,
      })
    }
    setWaiterSent(true)
    setShowWaiter(false)
  }

  if (loadingData) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'DM Sans,sans-serif', color:'#8a9e96' }}>
      Učitavanje menija...
    </div>
  )

  if (!r) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:'DM Sans,sans-serif', gap:12 }}>
      <div style={{ fontSize:48 }}>🍽️</div>
      <div style={{ fontSize:18, fontWeight:600, color:'#0e1a14' }}>Meni nije pronađen</div>
      <div style={{ color:'#8a9e96' }}>Provjerite URL ili kontaktirajte restoran.</div>
    </div>
  )

  return (
    <div className={styles.pageWrapper}>
    <div
      className={styles.page}
      style={{
        background: tpl.pageBg,
        '--tpl-brand': tpl.brand,
        '--tpl-brand-light': tpl.catBg,
        '--tpl-border': tpl.catBorder,
        '--tpl-price': tpl.priceColor,
        '--tpl-cat-color': tpl.catColor,
      }}
    >

      {/* HEADER */}
      <div className={styles.header} style={{ background: tpl.brand }}>
        <div className={styles.headerTop}>
          <div className={styles.tableTag}>{r.table}</div>
          <button className={styles.langToggle} onClick={() => setLang(isEn ? 'sr' : 'en')}>
            {isEn ? 'SR' : 'EN'}
          </button>
        </div>
        <div className={styles.restInfo}>
          <div className={styles.restLogo}>
            {r.logo_url
              ? <img src={r.logo_url} alt={r.name} className={styles.restLogoImg} />
              : r.name[0]
            }
          </div>
          <div>
            <div className={styles.restName}>{r.name}</div>
            <div className={styles.restMeta}>
              <span>⭐ {r.rating}</span>
              <span>📍 {r.location}</span>
              <span>🕐 {r.hours}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH */}
      <div className={styles.searchBar}>
        <span className={styles.searchIcon}>🔍</span>
        <span className={styles.searchPlaceholder}>
          {isEn ? 'Search menu...' : 'Pretražite meni...'}
        </span>
      </div>

      {/* SPECIAL OFFER */}
      {specialItem && (
        <div className={styles.special} style={{ background: tpl.brand }} onClick={() => setSelectedItem(specialItem)}>
          <div className={styles.specialLabel}>
            {isEn ? '⚡ Daily special' : '⚡ Dnevna ponuda'}
          </div>
          <div className={styles.specialName}>
            {specialItem.emoji} {isEn ? specialItem.nameEn : specialItem.name}
          </div>
          <div className={styles.specialDesc}>
            {isEn ? specialItem.descEn : specialItem.desc}
          </div>
          <div className={styles.specialPrice}>
            €{specialItem.price}
            <span className={styles.specialOld}>€{(parseFloat(specialItem.price) * 1.25).toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* CATEGORIES */}
      <div className={styles.cats}>
        {currentCategories.map(cat => (
          <button
            key={cat.id}
            className={`${styles.cat} ${activeCat === cat.id ? styles.catActive : ''}`}
            style={activeCat === cat.id ? { background: tpl.catBg, color: tpl.catColor, borderColor: tpl.catBorder } : {}}
            onClick={() => setActiveCat(cat.id)}
          >
            {cat.icon} {isEn ? (cat.name_en || cat.label || cat.name) : (cat.label || cat.name)}
          </button>
        ))}
      </div>

      {/* ALLERGEN NOTICE */}
      <div className={styles.allergenNote}>
        ⚠ {isEn
          ? 'Allergen information available on each item. Ask staff if unsure.'
          : 'Informacije o alergenima dostupne na svakom jelu. Pitajte osoblje.'}
      </div>

      {/* ITEMS */}
      <div className={styles.items}>
        {items.map(item => (
          <div key={item.id} className={styles.item} onClick={() => setSelectedItem(item)}>
            <div className={styles.itemEmoji} style={{ background: item.bg || '#e0f5ec' }}>
              {item.image_url
                ? <img src={item.image_url} alt={item.name} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:10}} />
                : item.emoji}
            </div>
            <div className={styles.itemBody}>
              <div className={styles.itemName}>{isEn ? (item.name_en || item.nameEn || item.name) : item.name}</div>
              <div className={styles.itemDesc}>{isEn ? (item.description_en || item.descEn || item.description) : (item.description || item.desc)}</div>
              {(item.tags || []).length > 0 && (
                <div className={styles.itemTags}>
                  {(item.tags || []).map(t => (
                    <span
                      key={t}
                      className={styles.itemTag}
                      style={{ background: TAG_CONFIG[t]?.bg, color: TAG_CONFIG[t]?.color }}
                    >
                      {isEn ? TAG_CONFIG[t]?.labelEn : TAG_CONFIG[t]?.label}
                    </span>
                  ))}
                </div>
              )}
              <div className={styles.itemFooter}>
                <span className={styles.itemPrice} style={{ color: tpl.priceColor }}>€{parseFloat(item.price).toFixed(2)}</span>
                {digitalOrdering && (
                  <button className={styles.itemAdd} style={{ background: tpl.brand }}>+</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* WAITER BUTTON */}
      <div className={styles.waiterSection}>
        {!waiterSent ? (
          <button className={styles.waiterBtn} onClick={() => setShowWaiter(true)}>
            🔔 {isEn ? 'Call waiter' : 'Pozovi konobara'}
          </button>
        ) : (
          <div className={styles.waiterSent} style={{ background: tpl.catBg, color: tpl.catColor }}>
            ✓ {isEn ? 'Request sent! Waiter is on the way.' : 'Zahtjev poslan! Konobar dolazi.'}
          </div>
        )}
      </div>

      {/* ITEM DETAIL OVERLAY */}
      {selectedItem && (
        <div className={styles.overlay} onClick={() => setSelectedItem(null)}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <button className={styles.sheetClose} onClick={() => setSelectedItem(null)}>✕</button>
            {selectedItem.image_url
              ? <img src={selectedItem.image_url} alt={selectedItem.name} style={{width:'100%',height:160,objectFit:'cover',borderRadius:12,marginBottom:12}} />
              : <div className={styles.sheetEmoji}>{selectedItem.emoji}</div>
            }
            <div className={styles.sheetName}>{isEn ? (selectedItem.name_en || selectedItem.nameEn || selectedItem.name) : selectedItem.name}</div>
            <div className={styles.sheetDesc}>{isEn ? (selectedItem.description_en || selectedItem.descEn || selectedItem.description) : (selectedItem.description || selectedItem.desc)}</div>
            <div className={styles.sheetDetails}>
              <div className={styles.sheetRow}>
                <span className={styles.sheetRowLabel}>{isEn ? 'Calories' : 'Kalorije'}</span>
                <span>{selectedItem.calories || selectedItem.cal || '—'} kcal</span>
              </div>
              <div className={styles.sheetRow}>
                <span className={styles.sheetRowLabel}>{isEn ? 'Allergens' : 'Alergeni'}</span>
                <span>{selectedItem.allergens || (isEn ? 'None' : 'Nema')}</span>
              </div>
              <div className={styles.sheetRow}>
                <span className={styles.sheetRowLabel}>{isEn ? 'Prep time' : 'Priprema'}</span>
                <span>{selectedItem.prep_time || selectedItem.time || '—'}</span>
              </div>
            </div>
            <div className={styles.sheetPrice} style={{ color: tpl.priceColor }}>€{parseFloat(selectedItem.price).toFixed(2)}</div>
            {digitalOrdering && (
              <button className={styles.sheetAdd} style={{ background: tpl.brand }}>
                {isEn ? 'Add to order' : 'Dodaj u narudžbu'}
              </button>
            )}
            {!digitalOrdering && (
              <div className={styles.orderingOff}>
                {isEn ? 'Online ordering is currently unavailable' : 'Naručivanje putem aplikacije nije dostupno'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* WAITER REQUEST OVERLAY */}
      {showWaiter && (
        <div className={styles.overlay} onClick={() => setShowWaiter(false)}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <button className={styles.sheetClose} onClick={() => setShowWaiter(false)}>✕</button>
            <div className={styles.waiterTitle}>
              {isEn ? 'What do you need?' : 'Šta vam je potrebno?'}
            </div>
            {[
              { icon: '🔔', sr: 'Pozovi konobara', en: 'Call waiter' },
              { icon: '🧾', sr: 'Donesi račun', en: 'Bring the bill' },
              { icon: '🥤', sr: 'Donesi vodu', en: 'Bring water' },
              { icon: '🍽️', sr: 'Skloni prazne tanjire', en: 'Clear the table' },
            ].map((opt, i) => (
              <button
                key={i}
                className={styles.waiterOpt}
                onClick={() => sendWaiterRequest(opt.sr)}
              >
                <span className={styles.waiterOptIcon}>{opt.icon}</span>
                <span>{isEn ? opt.en : opt.sr}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className={styles.footer}>
        <a href="/" className={styles.footerBrand}>
          Powered by <strong>smartmeni.me</strong>
        </a>
      </div>

    </div>
    </div>
  )
}


