import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTemplate } from '../lib/templates'
import styles from './GuestMenu.module.css'

// Ključ za localStorage sesiju gosta
const GUEST_SESSION_KEY = (slug) => `sm_guest_${slug}`
const CART_KEY = (slug) => `sm_cart_${slug}`
const ORDER_KEY = (slug) => `sm_order_${slug}`
const WAITER_KEY = (slug) => `sm_waiter_${slug}`

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
  const navigate = useNavigate()
  const [activeCat, setActiveCat] = useState('predjela')
  const [selectedItem, setSelectedItem] = useState(null)
  const [lang, setLang] = useState('sr')
  const [waiterSent, setWaiterSent] = useState(false)
  const [showWaiter, setShowWaiter] = useState(false)
  const [waiterRequestId, setWaiterRequestId] = useState(() => {
    try { return sessionStorage.getItem(WAITER_KEY(window.location.pathname.split('/')[1] || '')) || null }
    catch { return null }
  })
  const [waiterResolved, setWaiterResolved] = useState(false)
  const [waiterResponse, setWaiterResponse] = useState(null)
  const [realData, setRealData] = useState(null)
  const [loadingData, setLoadingData] = useState(true)
  const [cart, setCart] = useState(() => {
    try {
      const saved = sessionStorage.getItem(CART_KEY(window.location.pathname.split('/')[1] || ''))
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [showCart, setShowCart] = useState(false)
  const [orderSent, setOrderSent] = useState(false)
  const [lastOrderId, setLastOrderId] = useState(() => {
    try { return sessionStorage.getItem(ORDER_KEY(window.location.pathname.split('/')[1] || '')) || null }
    catch { return null }
  })
  const [orderSending, setOrderSending] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [guestSession, setGuestSession] = useState(null)
  const [loginForm, setLoginForm] = useState({ name: '', contact: '' })
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [lastActivity, setLastActivity] = useState(Date.now())

  // QR parametar — sačuvaj/osvježi timestamp pri svakom učitavanju sa ?qr=1
  // Ovo radi i pri ponovnom skeniranju nakon isteka sesije
  useEffect(() => {
    if (!slug || slug === 'demo') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('qr') === '1') {
      // Uvijek osvježi timestamp — novo skeniranje = nova sesija
      localStorage.setItem(`sm_qr_${slug}`, Date.now().toString())
      // Ukloni ?qr=1 iz URL-a (čisto) ali zadrži ?table= ako postoji
      const table = params.get('table')
      const cleanUrl = `${window.location.pathname}${table ? `?table=${table}` : ''}`
      window.history.replaceState({}, '', cleanUrl)
    }
  }, [slug])

  // Provjeri status aktivne narudžbe pri mountu — sinhrono briše ako je closed/served
  useEffect(() => {
    if (!slug || slug === 'demo') return
    const storedId = sessionStorage.getItem(ORDER_KEY(slug))
    if (!storedId) return
    supabase
      .from('orders').select('status').eq('id', storedId).single()
      .then(({ data }) => {
        if (!data || data.status === 'closed' || data.status === 'served') {
          sessionStorage.removeItem(ORDER_KEY(slug))
          setLastOrderId(null)
        }
      })
  }, [slug])

  // Učitaj guest sesiju iz localStorage kad znamo slug
  useEffect(() => {
    if (!slug || slug === 'demo') return
    try {
      const saved = localStorage.getItem(GUEST_SESSION_KEY(slug))
      const lastAct = localStorage.getItem(GUEST_SESSION_KEY(slug) + '_activity')
      if (saved && lastAct) {
        const elapsed = Date.now() - parseInt(lastAct, 10)
        if (elapsed < 10 * 60 * 1000) {
          setGuestSession(JSON.parse(saved))
        } else {
          localStorage.removeItem(GUEST_SESSION_KEY(slug))
          localStorage.removeItem(GUEST_SESSION_KEY(slug) + '_activity')
        }
      }
    } catch {}
  }, [slug])

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

      // Provjeri status aktivne narudžbe — obriši key ako je zatvorena/odbijena
      try {
        const storedOrderId = sessionStorage.getItem(ORDER_KEY(slug))
        if (storedOrderId) {
          const { data: ord } = await supabase
            .from('orders').select('status').eq('id', storedOrderId).single()
          if (!ord || ord.status === 'closed' || ord.status === 'served') {
            sessionStorage.removeItem(ORDER_KEY(slug))
            setLastOrderId(null)
          }
        }
      } catch {}
    }
    load()
  }, [slug])

  const isDemo = !slug || slug === 'demo' || !realData
  const data = isDemo ? DEMO_DATA : null
  const r = isDemo ? data.restaurant : realData?.restaurant
  const tpl = getTemplate(r?.template)
  const digitalOrdering = isDemo ? true : (r?.digital_ordering ?? true)
  const onlineReservations = isDemo ? true : (r?.online_reservations ?? false)
  const guestRegistration = isDemo ? true : (r?.guest_registration_enabled ?? true)
  const waiterEnabled = isDemo ? true : (r?.waiter_requests_enabled === false ? false : (r?.waiter_requests_enabled ?? true))

  // QR sesija — trajanje u minutama iz baze (default 30)
  const qrSessionMs = ((r?.qr_session_minutes || 30) * 60 * 1000)
  const isQRAccess = (() => {
    if (isDemo) return true
    try {
      // Provjeri ?qr=1 u URL-u (useEffect ga je već snimio u localStorage)
      const params = new URLSearchParams(window.location.search)
      if (params.get('qr') === '1') return true
      // Provjeri localStorage sesiju
      const ts = localStorage.getItem(`sm_qr_${slug}`)
      if (!ts) return false
      const elapsed = Date.now() - parseInt(ts, 10)
      if (elapsed > qrSessionMs) {
        localStorage.removeItem(`sm_qr_${slug}`)
        return false
      }
      return true
    } catch { return false }
  })()
  // qrExpired: gost koji JE skenirao ali mu je istekla sesija
  const qrExpired = (() => {
    if (isDemo) return false
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('qr') === '1') return false
      const ts = localStorage.getItem(`sm_qr_${slug}`)
      if (!ts) return false
      const elapsed = Date.now() - parseInt(ts, 10)
      return elapsed > qrSessionMs
    } catch { return false }
  })()

  // Vidljivost opcija (novi sistem — fallback na stare bool toggleove)
  const orderingVis = isDemo ? 'all' : !isQRAccess ? 'off' : (r?.ordering_visibility || (r?.digital_ordering === false ? 'off' : 'all'))
  const waiterVis = isDemo ? 'all' : !isQRAccess ? 'off' : (r?.waiter_visibility || (waiterEnabled ? 'all' : 'off'))
  const reservationVis = isDemo ? 'all' : (r?.reservation_visibility || (onlineReservations ? 'all' : 'off'))
  const registrationVis = isDemo ? 'all' : (r?.registration_visibility || (guestRegistration ? 'all' : 'off'))
  const tableNumber = isDemo ? 'Sto 4' : (new URLSearchParams(window.location.search).get('table') || '')
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
      const { data: req } = await supabase.from('waiter_requests').insert({
        restaurant_id: realData.restaurant.id,
        table_number: tableNumber || 'Online',
        request_type: type,
      }).select().single()
      if (req?.id) {
        setWaiterRequestId(req.id)
        setWaiterResolved(false)
        try { sessionStorage.setItem(WAITER_KEY(slug), req.id) } catch {}
        // Realtime — prati kad konobar označi kao riješeno
        const ch = supabase
          .channel(`waiter-req-${req.id}`)
          .on('postgres_changes', {
            event: 'UPDATE', schema: 'public', table: 'waiter_requests',
            filter: `id=eq.${req.id}`,
          }, (payload) => {
            if (payload.new.response) setWaiterResponse(payload.new.response)
            if (payload.new.is_resolved) {
              setWaiterResolved(true)
              try { sessionStorage.removeItem(WAITER_KEY(slug)) } catch {}
            }
          })
          .subscribe()
      }
    }
    setWaiterSent(true)
    setShowWaiter(false)
  }

  // Čuvaj košaricu u sessionStorage pri svakoj promjeni
  useEffect(() => {
    try { sessionStorage.setItem(CART_KEY(slug), JSON.stringify(cart)) } catch {}
  }, [cart, slug])

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { ...item, qty: 1 }]
    })
  }

  const removeFromCart = (itemId) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === itemId)
      if (existing?.qty > 1) return prev.map(c => c.id === itemId ? { ...c, qty: c.qty - 1 } : c)
      return prev.filter(c => c.id !== itemId)
    })
  }

  const cartTotal = cart.reduce((s, c) => s + parseFloat(c.price) * c.qty, 0)
  const cartCount = cart.reduce((s, c) => s + c.qty, 0)

  const sendOrder = async () => {
    if (cart.length === 0) return
    setOrderSending(true)
    if (!isDemo && realData?.restaurant) {
      // Kreiraj narudžbu
      const { data: order } = await supabase.from('orders').insert({
        restaurant_id: realData.restaurant.id,
        table_number: tableNumber || 'Online',
        status: 'received',
        total: cartTotal,
        guest_id: guestSession?.id || null,
      }).select().single()

      if (order) {
        // Dodaj stavke narudžbe
        await supabase.from('order_items').insert(
          cart.map(item => ({
            restaurant_id: realData.restaurant.id,
            order_id: order.id,
            menu_item_id: item.id,
            name: item.name,
            price: parseFloat(item.price),
            quantity: item.qty,
            category_id: item.category_id,
          }))
        )
        setLastOrderId(order.id)
        try { sessionStorage.setItem(ORDER_KEY(slug), order.id) } catch {}
      }
    }
    setOrderSent(true)
    setOrderSending(false)
    setCart([])
    setShowCart(false)
  }

  // ── Guest session funkcije ──────────────────────────────────
  const canSee = (visibility) => {
    if (visibility === 'off') return false
    if (visibility === 'registered') return !!guestSession
    return true
  }

  const saveGuestSession = (guest) => {
    const session = { id: guest.id, first_name: guest.first_name, last_name: guest.last_name, status: guest.status }
    const now = Date.now()
    setGuestSession(session)
    setLastActivity(now)
    try {
      localStorage.setItem(GUEST_SESSION_KEY(slug), JSON.stringify(session))
      localStorage.setItem(GUEST_SESSION_KEY(slug) + '_activity', now.toString())
    } catch {}
    setLoginForm({ name: '', contact: '' })
    setLoginError('')
    if (pendingAction) { pendingAction(); setPendingAction(null) }
  }

  const logoutGuest = () => {
    setGuestSession(null)
    setPendingAction(null)
    try {
      localStorage.removeItem(GUEST_SESSION_KEY(slug))
      localStorage.removeItem(GUEST_SESSION_KEY(slug) + '_activity')
    } catch {}
  }

  const requireLogin = (action) => {
    if (guestSession) { action(); return }
    // Sačuvaj pending akciju u sessionStorage da se izvrši po povratku
    try { sessionStorage.setItem(`sm_pending_${slug}`, action.toString()) } catch {}
    navigate(`/${slug}/prijava`)
  }

  const handleGuestLogin = async (e) => {
    e.preventDefault()
    setLoginLoading(true); setLoginError('')
    const nameParts = loginForm.name.trim().toLowerCase().split(' ')
    const contact = loginForm.contact.trim()
    const { data } = await supabase
      .from('guests')
      .select('id, first_name, last_name, status, phone, email')
      .eq('restaurant_id', r?.id)
      .or(`phone.eq.${contact},email.eq.${contact}`)
      .neq('status', 'blacklist')
      .neq('status', 'pending')
    setLoginLoading(false)
    if (!data?.length) { setLoginError('Nismo pronašli vaše podatke. Provjerite ime i kontakt.'); return }
    const match = data.find(g => {
      const fn = g.first_name?.toLowerCase() || ''
      const ln = g.last_name?.toLowerCase() || ''
      return nameParts.some(p => fn.includes(p) || ln.includes(p))
    })
    if (!match) { setLoginError('Ime se ne poklapa sa kontaktom. Pokušajte ponovo.'); return }
    saveGuestSession(match)
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
          <div className={styles.tableTag}>{tableNumber ? `Sto ${tableNumber}` : (r.table || '')}</div>
          <div className={styles.headerRight}>
            <button className={styles.langToggle} onClick={() => setLang(isEn ? 'sr' : 'en')}>
              {isEn ? 'SR' : 'EN'}
            </button>
          </div>
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
                {digitalOrdering && (() => {
                  const qty = cart.find(c => c.id === item.id)?.qty || 0
                  return qty > 0 ? (
                    <div className={styles.itemQtyControl} onClick={e => e.stopPropagation()}>
                      <button className={styles.itemQtyBtn} style={{ background: tpl.brand }} onClick={() => removeFromCart(item.id)}>−</button>
                      <span className={styles.itemQtyNum}>{qty}</span>
                      <button className={styles.itemQtyBtn} style={{ background: tpl.brand }} onClick={() => addToCart(item)}>+</button>
                    </div>
                  ) : (
                    <button
                      className={styles.itemAdd}
                      style={{ background: tpl.brand }}
                      onClick={e => { e.stopPropagation(); addToCart(item) }}
                    >+</button>
                  )
                })()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* QR SESIJA ISTEKLA */}
      {qrExpired && (
        <div className={styles.qrExpired}>
          <div className={styles.qrExpiredIcon}>⏱️</div>
          <div className={styles.qrExpiredTitle}>
            {isEn ? 'Session expired' : 'QR sesija je istekla'}
          </div>
          <div className={styles.qrExpiredDesc}>
            {isEn
              ? `Your ${r?.qr_session_minutes || 30}-minute session has ended. Please scan the QR code at your table again.`
              : `Vaša ${r?.qr_session_minutes || 30}-minutna sesija je završena. Skenirajte ponovo QR kod na stolu.`}
          </div>
        </div>
      )}

      {/* QR ONLY NOTICE — za goste koji nikad nisu skenirali */}
      {!isQRAccess && !qrExpired && !isDemo && (r?.ordering_visibility !== 'off' || r?.waiter_visibility !== 'off') && (
        <div className={styles.qrNotice}>
          📱 {isEn
            ? 'Scan the QR code at your table to order and call a waiter.'
            : 'Skenirajte QR kod na stolu za narudžbu i poziv konobara.'}
        </div>
      )}

      {/* WAITER BUTTON */}
      <div className={styles.waiterSection}>
        {digitalOrdering && cartCount > 0 && (
          <div className={styles.cartBar} onClick={() => setShowCart(true)}>
            <div className={styles.cartBarLeft}>
              <span style={{ fontSize: 16 }}>🛒</span>
              <span className={styles.cartBarLabel}>{isEn ? 'View order' : 'Pogledaj narudžbu'}</span>
              <span className={styles.cartBarCount}>{cartCount}</span>
            </div>
            <span className={styles.cartBarTotal}>€{cartTotal.toFixed(2)}</span>
          </div>
        )}
        {/* Sesija bar — kad je gost ulogovan */}
        {guestSession && (
          <div className={styles.guestSessionBar}>
            <span>👤 {guestSession.first_name} {guestSession.last_name}</span>
            <button className={styles.guestLogoutBtn} onClick={logoutGuest}>
              {isEn ? 'Logout' : 'Odjava'}
            </button>
          </div>
        )}

        {/* Poziv konobara */}
        {canSee(waiterVis) && (!waiterSent ? (
          <button className={styles.waiterBtn} onClick={() => {
            if (waiterVis === 'registered' && !guestSession) { requireLogin(() => setShowWaiter(true)); return }
            setShowWaiter(true)
          }}>
            🔔 {isEn ? 'Call waiter' : 'Pozovi konobara'}
          </button>
        ) : (
          <div className={styles.waiterSent} style={{
            background: waiterResolved ? '#e1f5ee' : waiterResponse ? '#eeedfe' : tpl.catBg,
            color: waiterResolved ? '#0d7a52' : waiterResponse ? '#534ab7' : tpl.catColor,
          }}>
            {waiterResolved ? (
              <div>
                ✓ {isEn ? 'Request resolved!' : 'Zahtjev riješen!'}
                {waiterResponse && <div style={{ fontSize: 12, marginTop: 4, opacity: 0.85 }}>💬 {waiterResponse}</div>}
              </div>
            ) : waiterResponse ? (
              <div>
                <div>💬 {waiterResponse}</div>
                <div style={{ fontSize: 11, marginTop: 3, opacity: 0.7 }}>
                  {isEn ? 'Waiter replied' : 'Konobar odgovorio'}
                </div>
              </div>
            ) : (
              <div className={styles.waiterPending}>
                <span className={styles.waiterSpinner} />
                {isEn ? 'Request sent — waiting for waiter...' : 'Zahtjev poslan — čekamo konobara...'}
              </div>
            )}
          </div>
        ))}

        {/* Rezervacija */}
        {canSee(reservationVis) && (
          <a
            href={(reservationVis === 'all' || guestSession) ? `/${isDemo ? 'demo' : slug}/rezervacija` : '#'}
            className={styles.reservationBtn}
            onClick={e => {
              if (reservationVis === 'registered' && !guestSession) {
                e.preventDefault()
                requireLogin(() => { window.location.href = `/${slug}/rezervacija` })
              }
            }}
          >
            📅 {isEn ? 'Reserve a table' : 'Rezerviši sto'}
          </a>
        )}

        {/* Separator MOJ NALOG */}
        {(canSee(registrationVis) || guestSession) && (
          <div className={styles.accountSeparator}>
            <div className={styles.accountSepLine} />
            <div className={styles.accountSepLabel}>{isEn ? 'MY ACCOUNT' : 'MOJ NALOG'}</div>
            <div className={styles.accountSepLine} />
          </div>
        )}

        {/* Nelogovan — dva dugmeta u redu */}
        {!guestSession && canSee(registrationVis) && (
          <div className={styles.accountRow}>
            <button className={styles.accountBtn} onClick={() => navigate(`/${isDemo ? 'demo' : slug}/registracija`)}>
              🎟️ {isEn ? 'Register' : 'Registruj se'}
            </button>
            <button className={styles.accountBtn} onClick={() => navigate(`/${isDemo ? 'demo' : slug}/prijava?return=/${isDemo ? 'demo' : slug}/profil`)}>
              👤 {isEn ? 'Login' : 'Prijava'}
            </button>
          </div>
        )}

        {/* Logovan — jedno dugme Moj profil */}
        {guestSession && (
          <button
            className={styles.accountBtnFull}
            onClick={() => { window.location.href = `/${isDemo ? 'demo' : slug}/profil` }}
          >
            👤 {isEn ? 'My profile' : 'Moj profil'}
          </button>
        )}
        {orderSent && (
          <div className={styles.orderSentMsg} style={{ background: tpl.catBg, color: tpl.catColor }}>
            ✓ {isEn ? 'Order sent! Thank you.' : 'Narudžba poslana! Hvala.'}
          </div>
        )}
        {/* Dugme za praćenje — vidljivo dok narudžba postoji u sessionStorage */}
        {lastOrderId && !isDemo && (
          <button
            className={styles.trackOrderBtn}
            style={{ borderColor: tpl.brand, color: tpl.brand }}
            onClick={() => navigate(`/${slug}/narudzba/${lastOrderId}`)}
          >
            📍 {isEn ? 'Track your order' : 'Prati narudžbu uživo'}
          </button>
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
              <button
                className={styles.sheetAdd}
                style={{ background: tpl.brand }}
                onClick={() => { addToCart(selectedItem); setSelectedItem(null) }}
              >
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

      {/* CART OVERLAY */}
      {showCart && (
        <div className={styles.overlay} onClick={() => setShowCart(false)}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <button className={styles.sheetClose} onClick={() => setShowCart(false)}>✕</button>
            <div className={styles.cartTitle}>{isEn ? 'Your order' : 'Vaša narudžba'}</div>

            {cart.length === 0 ? (
              <div className={styles.cartEmpty}>{isEn ? 'Cart is empty' : 'Košarica je prazna'}</div>
            ) : (
              <>
                <div className={styles.cartItems}>
                  {cart.map(item => (
                    <div key={item.id} className={styles.cartItem}>
                      <div className={styles.cartItemName}>{item.name}</div>
                      <div className={styles.cartItemControls}>
                        <button className={styles.cartQtyBtn} onClick={() => removeFromCart(item.id)}>−</button>
                        <span className={styles.cartQty}>{item.qty}</span>
                        <button className={styles.cartQtyBtn} onClick={() => addToCart(item)}>+</button>
                      </div>
                      <div className={styles.cartItemPrice}>€{(parseFloat(item.price) * item.qty).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
                <div className={styles.cartTotal}>
                  <span>{isEn ? 'Total' : 'Ukupno'}</span>
                  <span>€{cartTotal.toFixed(2)}</span>
                </div>
                <button
                  className={styles.sheetAdd}
                  style={{ background: tpl.brand }}
                  onClick={() => setShowConfirm(true)}
                  disabled={orderSending}
                >
                  {isEn ? 'Send order' : 'Pošalji narudžbu'}
                </button>
                {tableNumber && (
                  <div className={styles.cartTableNote}>
                    {isEn ? `Table ${tableNumber}` : `Sto ${tableNumber}`}
                  </div>
                )}
              </>
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
            {(r?.waiter_messages || [
              { icon: '🔔', sr: 'Pozovi konobara', en: 'Call waiter' },
              { icon: '🧾', sr: 'Donesi račun', en: 'Bring the bill' },
              { icon: '🥤', sr: 'Donesi vodu', en: 'Bring water' },
              { icon: '🍽️', sr: 'Skloni prazne tanjire', en: 'Clear the table' },
            ]).map((opt, i) => (
              <button
                key={i}
                className={styles.waiterOpt}
                onClick={() => sendWaiterRequest(opt.sr)}
              >
                <span className={styles.waiterOptIcon}>{opt.icon}</span>
                <span>{isEn ? (opt.en || opt.sr) : opt.sr}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CONFIRM ORDER OVERLAY */}
      {showConfirm && (
        <div className={styles.overlay} onClick={() => setShowConfirm(false)}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
            <div className={styles.sheetName}>
              {isEn ? 'Confirm order?' : 'Potvrdi narudžbu?'}
            </div>
            <div className={styles.sheetDesc}>
              {isEn
                ? `${cartCount} item(s) · €${cartTotal.toFixed(2)} total. Once sent, the order goes directly to the kitchen.`
                : `${cartCount} ${cartCount === 1 ? 'stavka' : 'stavke'} · ukupno €${cartTotal.toFixed(2)}. Nakon slanja, narudžba ide direktno u kuhinju.`
              }
            </div>
            <div className={styles.cartItems} style={{ textAlign: 'left', marginBottom: 16 }}>
              {cart.map(item => (
                <div key={item.id} className={styles.cartItem}>
                  <div className={styles.cartItemName}>{item.name}</div>
                  <div className={styles.cartQty}>×{item.qty}</div>
                  <div className={styles.cartItemPrice}>€{(parseFloat(item.price) * item.qty).toFixed(2)}</div>
                </div>
              ))}
            </div>
            <button
              className={styles.sheetAdd}
              style={{ background: tpl.brand, marginBottom: 10 }}
              onClick={async () => { setShowConfirm(false); await sendOrder() }}
              disabled={orderSending}
            >
              {orderSending
                ? (isEn ? 'Sending...' : 'Slanje...')
                : (isEn ? '✓ Yes, send order' : '✓ Da, pošalji narudžbu')}
            </button>
            <button
              className={styles.waiterBtn}
              onClick={() => setShowConfirm(false)}
            >
              {isEn ? 'Back to order' : 'Nazad na narudžbu'}
            </button>
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


