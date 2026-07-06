import { useState, useEffect, useRef } from 'react'
import { useContentTranslations } from '../lib/useContentTranslations'
import { formatMoney } from '../lib/currencies'
import { sortMenuItems, discountPercent, bundleItemsTotal, isBundleLive, isPromoLive, allocateBundleDiscount } from '../modules/menu/hooks/menuHelpers'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { getTemplate } from '../lib/templates'
import LanguageSwitcher from '../i18n/LanguageSwitcher'
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
  const { t, i18n } = useTranslation('menu')
  const [activeCat, setActiveCat] = useState('predjela')
  const [searchQuery, setSearchQuery] = useState('')
  const cartDockRef = useRef(null)
  const cartBarRef = useRef(null)
  const [selectedItem, setSelectedItem] = useState(null)
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
  const waiterChannelRef = useRef(null)
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
    // slug 'demo' JESTE pravi tenant (Adriatik, is_demo) — učitaj ga kao i svaki drugi.
    // Bez slug-a (nema rute) ostaje statični DEMO_DATA fallback.
    if (!slug) { setLoadingData(false); return }
    const load = async () => {
      const { data: rest } = await supabase
        .from('restaurants').select('*').eq('slug', slug).single()
      if (!rest) { setLoadingData(false); return }
      // Objekat bez restoran-menija → vodi na odgovarajuću javnu površinu vertikale
      // (hotel sajt ili rental izlog). Restoran-meni ostaje default kad postoji.
      const verts = rest.active_verticals || ['restaurant']
      if (!verts.includes('restaurant')) {
        if (verts.includes('hotel')) { navigate(`/${slug}/hotel`, { replace: true }); return }
        if (verts.includes('rental')) { navigate(`/${slug}/rentals`, { replace: true }); return }
      }
      const [{ data: cats }, { data: its }, { data: bnds }, { data: bndItems }, { data: ads }] = await Promise.all([
        supabase.from('categories').select('*').eq('restaurant_id', rest.id).order('sort_order'),
        supabase.from('menu_items').select('*').eq('restaurant_id', rest.id).eq('is_visible', true).order('sort_order'),
        supabase.from('menu_bundles').select('*').eq('restaurant_id', rest.id).eq('is_active', true).order('sort_order'),
        supabase.from('menu_bundle_items').select('bundle_id, menu_item_id, quantity').eq('restaurant_id', rest.id),
        supabase.from('partner_ads').select('*').eq('restaurant_id', rest.id).eq('is_active', true).order('sort_order'),
      ])
      setRealData({ restaurant: rest, categories: cats || [], items: its || [], bundles: bnds || [], bundleItems: bndItems || [], ads: ads || [] })
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
  // isDemo (gore) = demo-POGODNOSTI (naručivanje/konobar/'Sto 4'/QR bypass, lažni order flow).
  // noData = pravi tenant NIJE učitan (nema slug-a ili fetch pao) → statični DEMO_DATA fallback.
  // Razdvojeno da /demo (slug 'demo' = pravi is_demo tenant) prikaže SEEDOVANE podatke
  // (slike/ponuda/paket/AI prevodi), a da demo-pogodnosti ostanu uključene.
  const noData = !realData
  const data = noData ? DEMO_DATA : null
  const r = noData ? data.restaurant : realData?.restaurant
  // AI prevodi tenant-sadržaja za aktivni jezik (statični fallback nema id → null).
  const tr = useContentTranslations(noData ? null : r?.id)
  const tpl = getTemplate(r?.template, r?.color)
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
  // Eksplicitna admin postavka ima prednost nad QR restrikcijom — bez QR je 'off' samo ako admin nije ništa postavio
  const orderingVis = isDemo ? 'all' : r?.ordering_visibility ? r.ordering_visibility : !isQRAccess ? 'off' : (r?.digital_ordering === false ? 'off' : 'all')
  const waiterVis = isDemo ? 'all' : r?.waiter_visibility ? r.waiter_visibility : !isQRAccess ? 'off' : (waiterEnabled ? 'all' : 'off')
  const reservationVis = isDemo ? 'all' : (r?.reservation_visibility || (onlineReservations ? 'all' : 'off'))
  const registrationVis = isDemo ? 'all' : (r?.registration_visibility || (guestRegistration ? 'all' : 'off'))
  // Hotel/spa/booking opcije imaju smisla samo ako tenant ima hotel vertikalu.
  // Vertikala (a NE addon) je mjerilo — addon je pod beta modom svima true, pa bi
  // se inače hotel/spa pokazivali i restoranu-only nalogu.
  const hasHotelVertical = (r?.active_verticals ?? ['restaurant']).includes('hotel')
  const hotelVis = (isDemo || !hasHotelVertical) ? 'off' : (r?.hotel_visibility || 'off')
  const spaVis = (isDemo || !hasHotelVertical) ? 'off' : (r?.spa_visibility || 'off')
  const hasRentalVertical = (r?.active_verticals ?? ['restaurant']).includes('rental')
  const rentalVis = isDemo ? 'all' : (!hasRentalVertical ? 'off' : (r?.rental_visibility || 'off'))
  const tableNumber = isDemo ? 'Sto 4' : (new URLSearchParams(window.location.search).get('table') || '')
  const currentCategories = noData ? data.categories : realData?.categories || []
  const allItems = noData
    ? Object.values(data.items).flat()
    : realData?.items || []
  const items = noData
    ? (data.items[activeCat] || [])
    : sortMenuItems(allItems.filter(i => i.category_id === activeCat))
  const isEn = i18n.language === 'en'
  const specialItems = allItems.filter(i => noData ? i.special : i.is_special)

  // Paketi (Faza 2): aktivni paketi unutar perioda važenja → u "Ponudi dana".
  // Ušteda se računa iz aktuelnih cijena artikala (priceById), bundle_price je naplaćeno.
  const priceById = Object.fromEntries(allItems.map(i => [i.id, i.price]))
  const bundleItemsByBundle = (() => {
    const m = {}
    for (const r of (noData ? [] : realData?.bundleItems || [])) {
      if (!m[r.bundle_id]) m[r.bundle_id] = []
      m[r.bundle_id].push(r)
    }
    return m
  })()
  const liveBundles = noData ? [] : (realData?.bundles || []).filter(isBundleLive)

  // Reklame partnera (Faza 3): aktivne reklame unutar perioda, grupisane po poziciji.
  const liveAds = noData ? [] : (realData?.ads || []).filter(isPromoLive)
  const renderAds = (place) => {
    const list = liveAds.filter(a => a.placement === place)
    if (list.length === 0) return null
    return (
      <div className={styles.ads}>
        {list.map(a => {
          const title = tr('partner_ad', a.id, 'title', a.title)
          const sub = tr('partner_ad', a.id, 'subtitle', a.subtitle || '')
          // Veličina/izgled bannera (compact = slika sa strane; banner/large = preko širine)
          const type = (a.display_type === 'compact' || a.display_type === 'large') ? a.display_type : 'banner'
          const containerCls = type === 'compact' ? styles.adRow : styles.adBanner
          const imgCls = type === 'compact' ? styles.adImgCompact : (type === 'large' ? `${styles.adImg} ${styles.adImgLarge}` : styles.adImg)
          const inner = (
            <div className={containerCls}>
              {a.image_url && <img className={imgCls} src={a.image_url} alt={title} loading="lazy" decoding="async" />}
              <div className={styles.adBody}>
                <span className={styles.adTag}>{t('adLabel')}</span>
                <div className={styles.adTitle}>{title}</div>
                {sub && <div className={styles.adSubtitle}>{sub}</div>}
              </div>
            </div>
          )
          return a.link_url
            ? <a key={a.id} href={a.link_url} target="_blank" rel="noreferrer noopener" className={styles.adLink}>{inner}</a>
            : <div key={a.id} className={styles.adLink}>{inner}</div>
        })}
      </div>
    )
  }

  // Pretraga: kad ima upita, filtriraj SVE artikle (kroz sve kategorije) po nazivu/opisu —
  // i po izvoru (me/en) i po prevedenoj vrijednosti za aktivni jezik (tr). Bez upita
  // prikazujemo artikle aktivne kategorije kao i prije.
  const searchActive = searchQuery.trim().length > 0
  const displayedItems = (() => {
    if (!searchActive) return items
    const q = searchQuery.trim().toLowerCase()
    return allItems.filter(i => {
      const parts = [i.name, i.name_en, i.nameEn, i.description, i.description_en, i.descEn, i.desc]
      if (!isDemo) {
        parts.push(tr('menu_item', i.id, 'name', ''))
        parts.push(tr('menu_item', i.id, 'description', ''))
      }
      return parts.filter(Boolean).join(' ').toLowerCase().includes(q)
    })
  })()

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
        if (waiterChannelRef.current) supabase.removeChannel(waiterChannelRef.current)
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
        waiterChannelRef.current = ch
      }
    }
    setWaiterSent(true)
    setShowWaiter(false)
  }

  // Cleanup waiter realtime channel pri unmount
  useEffect(() => {
    return () => { if (waiterChannelRef.current) supabase.removeChannel(waiterChannelRef.current) }
  }, [])

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

  // Dodaj PAKET u korpu kao jedan red (nosi bundle_price); komponente se pamte da bi
  // se pri slanju narudžbe razložile na header + stavke za kuhinju (vidi sendOrder).
  const addBundleToCart = (b, rows) => {
    const components = (rows || []).map(bi => {
      const it = allItems.find(i => i.id === bi.menu_item_id)
      if (!it) return null
      // Efektivna PDV stopa komponente: jelo → kategorija (za fiskalnu raspodjelu popusta).
      const cat = currentCategories.find(c => c.id === it.category_id)
      const vat = it.vat_rate_key || cat?.vat_rate_key || null
      return { menu_item_id: it.id, name: it.name, quantity: bi.quantity, category_id: it.category_id, unit_price: it.price, vat_rate_key: vat }
    }).filter(Boolean)
    addToCart({ id: b.id, name: b.name, price: b.bundle_price, emoji: b.emoji, image_url: b.image_url, is_bundle: true, components })
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
    // Odbrana u dubinu: ne dozvoli slanje ako naručivanje nije dopušteno za ovog
    // gosta (npr. 'registered' bez sesije, ili 'off').
    if (orderingVis === 'off' || (orderingVis === 'registered' && !guestSession)) return
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
        // Stavke narudžbe. SVI redovi imaju ISTI skup ključeva (PostgREST bulk-insert to
        // zahtijeva: "All object keys must match") — paket širi na komponente (puna cijena)
        // + negativnu stavku popusta po PDV grupi.
        const rid = realData.restaurant.id
        const mkRow = (o) => ({
          restaurant_id: rid, order_id: order.id,
          menu_item_id: o.menu_item_id ?? null, name: o.name,
          price: o.price, quantity: o.quantity,
          category_id: o.category_id ?? null, bundle_id: o.bundle_id ?? null,
          is_bundle_component: o.is_bundle_component ?? false, vat_rate_key: o.vat_rate_key ?? null,
        })
        const rows = []
        for (const item of cart) {
          if (item.is_bundle) {
            const comps = item.components || []
            for (const comp of comps) {
              rows.push(mkRow({
                menu_item_id: comp.menu_item_id, name: comp.name,
                price: parseFloat(comp.unit_price), quantity: comp.quantity * item.qty,
                category_id: comp.category_id, bundle_id: item.id, is_bundle_component: true,
              }))
            }
            const grossLines = comps.map(c => ({
              vat_rate_key: c.vat_rate_key,
              gross_cents: Math.round(parseFloat(c.unit_price) * 100) * c.quantity * item.qty,
            }))
            const bundleTotalCents = Math.round(parseFloat(item.price) * 100) * item.qty
            const origCents = grossLines.reduce((s, g) => s + g.gross_cents, 0)
            const pct = origCents > 0 ? Math.round((1 - bundleTotalCents / origCents) * 100) : 0
            for (const d of allocateBundleDiscount(grossLines, bundleTotalCents)) {
              rows.push(mkRow({
                menu_item_id: null, name: `Popust: ${item.name}${pct > 0 ? ` (−${pct}%)` : ''}`,
                price: -(d.discount_cents / 100), quantity: 1,
                bundle_id: item.id, is_bundle_component: false, vat_rate_key: d.vat_rate_key,
              }))
            }
          } else {
            rows.push(mkRow({
              menu_item_id: item.id, name: item.name,
              price: parseFloat(item.price), quantity: item.qty, category_id: item.category_id,
            }))
          }
        }
        const { error: itemsErr } = await supabase.from('order_items').insert(rows)
        if (itemsErr) console.error('order_items insert', itemsErr)
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
  // Naručivanje poštuje ordering_visibility (off/registered/all) — isto kao ostale
  // kontrole. Ranije je gejtovano legacy bool-om digital_ordering pa se "registered"
  // ignorisao (svako je mogao naručiti).
  const canOrder = canSee(orderingVis)
  // Dok je otvoren bilo koji modal (poziv konobara, košarica, detalj jela, potvrda),
  // floating dugmad (cart bar + booking FAB) se sakrivaju da ne "žive" preko modala.
  const overlayOpen = showWaiter || showCart || showConfirm || !!selectedItem
  const cartBarVisible = canOrder && cartCount > 0 && !overlayOpen
  // "Rezerviši smještaj" FAB ostaje floating; cart bar je uvijek fixed (pluta), ali ga uz
  // skrol PODIŽEMO da prati rezervisani prostor (spacer) iznad sekcije "Moj nalog" — kreće se
  // u korak sa skrolom (kao sticky) pa nema skoka, a spacer čuva prostor (bez preklapanja).
  // (Pravi position:sticky ne radi jer je roditelj prekratak da pluta kroz cijeli skrol.)
  const bookingFabVisible = !isDemo && hasHotelVertical && !!r?.show_booking_button
  useEffect(() => {
    if (!cartBarVisible) return
    const base = bookingFabVisible ? 84 : 12
    let raf = 0
    const update = () => {
      raf = 0
      const spacer = cartDockRef.current, bar = cartBarRef.current
      if (!spacer || !bar) return
      const spacerBottom = spacer.getBoundingClientRect().bottom
      bar.style.bottom = Math.max(base, window.innerHeight - spacerBottom) + 'px'
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [cartBarVisible, bookingFabVisible, r?.id])

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
    <>
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
          <div className={styles.tableTag}>{tableNumber ? t('tableLabel', { n: tableNumber }) : (r.table || '')}</div>
          <div className={styles.headerRight}>
            <LanguageSwitcher variant="dark" />
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
        <input
          className={styles.searchInput}
          type="search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('search')}
          aria-label={t('search')}
        />
      </div>

      {/* REKLAME PARTNERA — pozicija "top" (poslije pretrage) */}
      {!searchActive && renderAds('top')}

      {/* SPECIAL OFFER — dnevna ponuda (više artikala, horizontalni skrol) */}
      {(specialItems.length > 0 || liveBundles.length > 0) && !searchActive && (
        <div className={styles.specials}>
          <div className={styles.specialsHead}>⚡ {t('dailySpecial')}</div>
          <div className={styles.specialsScroll}>
            {liveBundles.map(b => {
              const rows = bundleItemsByBundle[b.id] || []
              const sum = bundleItemsTotal(rows, priceById)
              const pct = discountPercent(b.bundle_price, sum)
              const nm = tr('menu_bundle', b.id, 'name', b.name)
              return (
                <div key={b.id} className={`${styles.specialCard} ${styles.bundleCard}`}>
                  <div className={styles.specialCardImg} style={b.image_url ? undefined : { background: tpl.catBg || '#e0f5ec' }}>
                    {b.image_url
                      ? <img src={b.image_url} alt={nm} loading="lazy" decoding="async" />
                      : <span className={styles.specialCardEmoji}>{b.emoji || '🎁'}</span>}
                    <span className={styles.bundleTag}>{t('bundleTag')}</span>
                  </div>
                  <div className={styles.specialCardInfo}>
                    <div className={styles.specialCardName}>{nm}</div>
                    <div className={styles.bundleItemsList}>
                      {rows.map(bi => {
                        const it = allItems.find(i => i.id === bi.menu_item_id)
                        if (!it) return null
                        const inm = tr('menu_item', it.id, 'name', isEn ? (it.name_en || it.name) : it.name)
                        return <div key={bi.menu_item_id} className={styles.bundleItemLine}>{bi.quantity}× {inm}</div>
                      })}
                    </div>
                    <div className={styles.specialCardPrice} style={{ color: tpl.priceColor }}>
                      {formatMoney(b.bundle_price, r?.currency, i18n.language)}
                      {pct != null && (
                        <>
                          <span className={styles.specialOld}>{formatMoney(sum, r?.currency, i18n.language)}</span>
                          <span className={styles.discountBadge}>−{pct}%</span>
                        </>
                      )}
                    </div>
                    {canOrder && (
                      <button
                        className={styles.bundleAddBtn}
                        style={{ background: tpl.brand }}
                        onClick={() => addBundleToCart(b, rows)}
                      >
                        + {t('addToOrder')}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            {specialItems.map(it => {
              const nm = tr('menu_item', it.id, 'name', isEn ? (it.name_en || it.nameEn || it.name) : it.name)
              return (
                <div key={it.id} className={styles.specialCard} onClick={() => setSelectedItem(it)}>
                  <div className={styles.specialCardImg} style={it.image_url ? undefined : { background: it.bg || tpl.catBg || '#e0f5ec' }}>
                    {it.image_url
                      ? <img src={it.image_url} alt={nm} loading="lazy" decoding="async" onError={e => { const p = e.currentTarget.parentElement; if (p) p.textContent = it.emoji || '🍽️' }} />
                      : <span className={styles.specialCardEmoji}>{it.emoji}</span>}
                  </div>
                  <div className={styles.specialCardInfo}>
                    <div className={styles.specialCardName}>
                      {nm}
                      {it.portion && <span className={styles.itemPortion}>· {it.portion}</span>}
                    </div>
                    {(() => {
                      const ds = tr('menu_item', it.id, 'description', isEn ? (it.description_en || it.descEn || it.description) : (it.description || it.desc))
                      return ds ? <div className={styles.specialCardDesc}>{ds}</div> : null
                    })()}
                    <div className={styles.specialCardPrice} style={{ color: tpl.priceColor }}>
                      {formatMoney(it.price, r?.currency, i18n.language)}
                      {(() => {
                        const dp = discountPercent(it.price, it.compare_at_price)
                        return dp != null ? (
                          <>
                            <span className={styles.specialOld}>{formatMoney(it.compare_at_price, r?.currency, i18n.language)}</span>
                            <span className={styles.discountBadge}>−{dp}%</span>
                          </>
                        ) : null
                      })()}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* REKLAME PARTNERA — pozicija "middle" (poslije Ponude dana) */}
      {!searchActive && renderAds('middle')}

      {/* CATEGORIES */}
      {!searchActive && (
      <div className={styles.cats}>
        {currentCategories.map(cat => (
          <button
            key={cat.id}
            className={`${styles.cat} ${activeCat === cat.id ? styles.catActive : ''}`}
            /* Selektovano = puna brend boja + bijeli tekst (.catActive) → visok kontrast.
               (Ranije svijetla catBg + forsiran bijeli tekst = tekst se nije vidio.) */
            style={activeCat === cat.id ? { background: tpl.brand, borderColor: tpl.brand } : {}}
            onClick={() => setActiveCat(cat.id)}
          >
            {cat.icon} {tr('category', cat.id, 'name', isEn ? (cat.name_en || cat.label || cat.name) : (cat.label || cat.name))}
          </button>
        ))}
      </div>
      )}

      {/* ALLERGEN NOTICE */}
      <div className={styles.allergenNote}>
        ⚠ {t('allergenNote')}
      </div>

      {/* ITEMS */}
      {searchActive && displayedItems.length === 0 && (
        <div className={styles.searchEmpty}>{t('searchNoResults')}</div>
      )}
      <div className={styles.items}>
        {displayedItems.map(item => (
          <div key={item.id} className={styles.item} onClick={() => setSelectedItem(item)}>
            <div className={styles.itemEmoji} style={{ background: item.bg || '#e0f5ec' }}>
              {item.image_url
                ? <img src={item.image_url} alt={item.name} loading="lazy" decoding="async" onError={e => { const p = e.currentTarget.parentElement; if (p) p.textContent = item.emoji || '🍽️' }} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:10}} />
                : item.emoji}
            </div>
            <div className={styles.itemBody}>
              {item.is_sponsored && (
                <div className={styles.sponsorBadge}>⭐ {item.sponsor_label || t('sponsoredBadge')}</div>
              )}
              <div className={styles.itemName}>
                {tr('menu_item', item.id, 'name', isEn ? (item.name_en || item.nameEn || item.name) : item.name)}
                {item.portion && <span className={styles.itemPortion}>· {item.portion}</span>}
              </div>
              <div className={styles.itemDesc}>{tr('menu_item', item.id, 'description', isEn ? (item.description_en || item.descEn || item.description) : (item.description || item.desc))}</div>
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
                <span className={styles.itemPriceWrap}>
                  <span className={styles.itemPrice} style={{ color: tpl.priceColor }}>{formatMoney(item.price, r?.currency, i18n.language)}</span>
                  {(() => {
                    const dp = discountPercent(item.price, item.compare_at_price)
                    return dp != null ? (
                      <>
                        <span className={styles.itemOldPrice}>{formatMoney(item.compare_at_price, r?.currency, i18n.language)}</span>
                        <span className={styles.discountBadge}>−{dp}%</span>
                      </>
                    ) : null
                  })()}
                </span>
                {canOrder && (() => {
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

      {/* REKLAME PARTNERA — pozicija "bottom" (poslije liste artikala) */}
      {!searchActive && renderAds('bottom')}

      {/* QR SESIJA ISTEKLA */}
      {qrExpired && (
        <div className={styles.qrExpired}>
          <div className={styles.qrExpiredIcon}>⏱️</div>
          <div className={styles.qrExpiredTitle}>
            {t('sessionExpired')}
          </div>
          <div className={styles.qrExpiredDesc}>
            {t('sessionExpiredDesc', { minutes: r?.qr_session_minutes || 30 })}
          </div>
        </div>
      )}

      {/* QR ONLY NOTICE — za goste koji nikad nisu skenirali */}
      {!isQRAccess && !qrExpired && !isDemo && (r?.ordering_visibility !== 'off' || r?.waiter_visibility !== 'off') && (
        <div className={styles.qrNotice}>
          📱 {t('qrNotice')}
        </div>
      )}

      {/* WAITER BUTTON */}
      <div className={styles.waiterSection}>
        {/* Sesija bar — kad je gost ulogovan */}
        {guestSession && (
          <div className={styles.guestSessionBar}>
            <span>👤 {guestSession.first_name} {guestSession.last_name}</span>
            <button className={styles.guestLogoutBtn} onClick={logoutGuest}>
              {t('logout')}
            </button>
          </div>
        )}

        {/* Poziv konobara */}
        {canSee(waiterVis) && (!waiterSent ? (
          <button className={styles.waiterBtn} onClick={() => {
            if (waiterVis === 'registered' && !guestSession) { requireLogin(() => setShowWaiter(true)); return }
            setShowWaiter(true)
          }}>
            🔔 {t('callWaiter')}
          </button>
        ) : (
          <div className={styles.waiterSent} style={{
            background: waiterResolved ? '#e1f5ee' : waiterResponse ? '#eeedfe' : tpl.catBg,
            color: waiterResolved ? '#0d7a52' : waiterResponse ? '#534ab7' : tpl.catColor,
          }}>
            {waiterResolved ? (
              <div>
                ✓ {t('requestResolved')}
                {waiterResponse && <div style={{ fontSize: 12, marginTop: 4, opacity: 0.85 }}>💬 {waiterResponse}</div>}
              </div>
            ) : waiterResponse ? (
              <div>
                <div>💬 {waiterResponse}</div>
                <div style={{ fontSize: 11, marginTop: 3, opacity: 0.7 }}>
                  {t('waiterReplied')}
                </div>
              </div>
            ) : (
              <div className={styles.waiterPending}>
                <span className={styles.waiterSpinner} />
                {t('requestSent')}
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
            📅 {t('reserveTable')}
          </a>
        )}

        {/* Hotel landing link */}
        {canSee(hotelVis) && (
          <a href={`/${slug}/hotel`} className={styles.reservationBtn}>
            🏨 {t('hotelInfo')}
          </a>
        )}

        {/* Spa & Wellness booking link */}
        {canSee(spaVis) && (
          <a href={`/${slug}/spa`} className={styles.reservationBtn}>
            ✨ {t('spaWellness')}
          </a>
        )}

        {/* Iznajmi smještaj (rental vertikala) → rental hub */}
        {canSee(rentalVis) && (
          <a href={`/${isDemo ? 'demo' : slug}/rentals`} className={styles.reservationBtn}>
            🏖️ {t('rentAccommodation')}
          </a>
        )}

        {/* Cart bar — uvijek fixed (pluta), uz skrol se podiže da sjedne u ovaj spacer
            (rezervisan prostor) odmah iznad "Moj nalog". Spacer čuva prostor → bez preklapanja. */}
        {cartBarVisible && (
          <>
            <div ref={cartDockRef} aria-hidden className={styles.cartDockSpacer} />
            <div
              ref={cartBarRef}
              className={styles.cartBar}
              style={{ borderLeftColor: tpl.brand }}
              onClick={() => setShowCart(true)}
            >
              <div className={styles.cartBarLeft}>
                <span style={{ fontSize: 16 }}>🛒</span>
                <span className={styles.cartBarLabel}>{t('viewOrder')}</span>
                <span className={styles.cartBarCount} style={{ background: tpl.brand }}>{cartCount}</span>
              </div>
              <span className={styles.cartBarTotal} style={{ color: tpl.brand }}>{formatMoney(cartTotal, r?.currency, i18n.language)}</span>
            </div>
          </>
        )}

        {/* Separator MOJ NALOG */}
        {(canSee(registrationVis) || guestSession) && (
          <div className={styles.accountSeparator}>
            <div className={styles.accountSepLine} />
            <div className={styles.accountSepLabel}>{t('myAccount')}</div>
            <div className={styles.accountSepLine} />
          </div>
        )}

        {/* Nelogovan — dva dugmeta u redu */}
        {!guestSession && canSee(registrationVis) && (
          <div className={styles.accountRow}>
            <button className={styles.accountBtn} onClick={() => navigate(`/${isDemo ? 'demo' : slug}/registracija`)}>
              🎟️ {t('register')}
            </button>
            <button className={styles.accountBtn} onClick={() => navigate(`/${isDemo ? 'demo' : slug}/prijava?return=/${isDemo ? 'demo' : slug}/profil`)}>
              👤 {t('login')}
            </button>
          </div>
        )}

        {/* Logovan — jedno dugme Moj profil */}
        {guestSession && (
          <button
            className={styles.accountBtnFull}
            onClick={() => { window.location.href = `/${isDemo ? 'demo' : slug}/profil` }}
          >
            👤 {t('myProfile')}
          </button>
        )}
        {orderSent && (
          <div className={styles.orderSentMsg} style={{ background: tpl.catBg, color: tpl.catColor }}>
            ✓ {t('orderSentThanks')}
          </div>
        )}
        {/* Dugme za praćenje — vidljivo dok narudžba postoji u sessionStorage */}
        {lastOrderId && !isDemo && (
          <button
            className={styles.trackOrderBtn}
            style={{ borderColor: tpl.brand, color: tpl.brand }}
            onClick={() => navigate(`/${slug}/narudzba/${lastOrderId}`)}
          >
            📍 {t('trackOrder')}
          </button>
        )}
      </div>

      {/* ITEM DETAIL OVERLAY */}
      {selectedItem && (
        <div className={styles.overlay} onClick={() => setSelectedItem(null)}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <button className={styles.sheetClose} onClick={() => setSelectedItem(null)}>✕</button>
            {selectedItem.image_url
              ? <img src={selectedItem.image_url} alt={selectedItem.name} loading="lazy" decoding="async" onError={e => { e.currentTarget.style.display = 'none' }} style={{width:'100%',height:160,objectFit:'cover',borderRadius:12,marginBottom:12}} />
              : <div className={styles.sheetEmoji}>{selectedItem.emoji}</div>
            }
            <div className={styles.sheetName}>{tr('menu_item', selectedItem.id, 'name', isEn ? (selectedItem.name_en || selectedItem.nameEn || selectedItem.name) : selectedItem.name)}</div>
            <div className={styles.sheetDesc}>{tr('menu_item', selectedItem.id, 'description', isEn ? (selectedItem.description_en || selectedItem.descEn || selectedItem.description) : (selectedItem.description || selectedItem.desc))}</div>
            <div className={styles.sheetDetails}>
              <div className={styles.sheetRow}>
                <span className={styles.sheetRowLabel}>{t('portion')}</span>
                <span>{selectedItem.portion || '—'}</span>
              </div>
              <div className={styles.sheetRow}>
                <span className={styles.sheetRowLabel}>{t('calories')}</span>
                <span>{selectedItem.calories || selectedItem.cal || '—'} kcal</span>
              </div>
              <div className={styles.sheetRow}>
                <span className={styles.sheetRowLabel}>{t('allergens')}</span>
                <span>{selectedItem.allergens || t('none')}</span>
              </div>
              <div className={styles.sheetRow}>
                <span className={styles.sheetRowLabel}>{t('prepTime')}</span>
                <span>{selectedItem.prep_time || selectedItem.time || '—'}</span>
              </div>
            </div>
            <div className={styles.sheetPrice} style={{ color: tpl.priceColor }}>{formatMoney(selectedItem.price, r?.currency, i18n.language)}</div>
            {canOrder && (
              <button
                className={styles.sheetAdd}
                style={{ background: tpl.brand }}
                onClick={() => { addToCart(selectedItem); setSelectedItem(null) }}
              >
                {t('addToOrder')}
              </button>
            )}
            {!canOrder && (
              <div className={styles.orderingOff}>
                {orderingVis === 'registered' ? t('loginToOrder') : t('orderingUnavailable')}
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
            <div className={styles.cartTitle}>{t('yourOrder')}</div>

            {cart.length === 0 ? (
              <div className={styles.cartEmpty}>{t('cartEmpty')}</div>
            ) : (
              <>
                <div className={styles.cartItems}>
                  {cart.map(item => (
                    <div key={item.id} className={styles.cartItem}>
                      <div className={styles.cartItemName}>
                        {item.is_bundle && '🎁 '}{item.name}
                        {item.is_bundle && (item.components || []).length > 0 && (
                          <div className={styles.cartBundleComps}>
                            {item.components.map(c => `${c.quantity}× ${c.name}`).join(', ')}
                          </div>
                        )}
                      </div>
                      <div className={styles.cartItemControls}>
                        <button className={styles.cartQtyBtn} onClick={() => removeFromCart(item.id)}>−</button>
                        <span className={styles.cartQty}>{item.qty}</span>
                        <button className={styles.cartQtyBtn} onClick={() => addToCart(item)}>+</button>
                      </div>
                      <div className={styles.cartItemPrice}>{formatMoney(parseFloat(item.price) * item.qty, r?.currency, i18n.language)}</div>
                    </div>
                  ))}
                </div>
                <div className={styles.cartTotal}>
                  <span>{t('total')}</span>
                  <span>{formatMoney(cartTotal, r?.currency, i18n.language)}</span>
                </div>
                <button
                  className={styles.sheetAdd}
                  style={{ background: tpl.brand }}
                  onClick={() => setShowConfirm(true)}
                  disabled={orderSending}
                >
                  {t('sendOrder')}
                </button>
                {tableNumber && (
                  <div className={styles.cartTableNote}>
                    {t('tableLabel', { n: tableNumber })}
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
              {t('whatDoYouNeed')}
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
                <span>{tr('waiter_message', opt.id, 'text', isEn ? (opt.en || opt.sr) : opt.sr)}</span>
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
              {t('confirmOrder')}
            </div>
            <div className={styles.sheetDesc}>
              {t('confirmOrderDesc', { count: cartCount, total: cartTotal.toFixed(2) })}
            </div>
            <div className={styles.cartItems} style={{ textAlign: 'left', marginBottom: 16 }}>
              {cart.map(item => (
                <div key={item.id} className={styles.cartItem}>
                  <div className={styles.cartItemName}>{item.name}</div>
                  <div className={styles.cartQty}>×{item.qty}</div>
                  <div className={styles.cartItemPrice}>{formatMoney(parseFloat(item.price) * item.qty, r?.currency, i18n.language)}</div>
                </div>
              ))}
            </div>
            <button
              className={styles.sheetAdd}
              style={{ background: tpl.brand, marginBottom: 10 }}
              onClick={async () => { setShowConfirm(false); await sendOrder() }}
              disabled={orderSending}
            >
              {orderSending ? t('sending') : `✓ ${t('yesSendOrder')}`}
            </button>
            <button
              className={styles.waiterBtn}
              onClick={() => setShowConfirm(false)}
            >
              {t('backToOrder')}
            </button>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className={styles.footer}>
        <a href="/" className={styles.footerBrand}>
          Powered by <strong>rest.by.me</strong>
        </a>
      </div>

    </div>
    </div>

    {/* Floating booking button */}
    {!isDemo && hasHotelVertical && r?.show_booking_button && !overlayOpen && (
      <button
        className={styles.bookingFab}
        style={{ background: tpl.brand }}
        onClick={() => navigate(`/${slug}/book`)}
      >
        🏨 <span>{t('bookAccommodation')}</span>
      </button>
    )}
    </>
  )
}


