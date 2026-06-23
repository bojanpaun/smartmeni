import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { formatMoney } from '../../../lib/currencies'
import { useMenuData, cartTotal } from '../../../modules/menu/hooks/useMenuData'
import { allocateBundleDiscount, isPromoLive } from '../../../modules/menu/hooks/menuHelpers'
import s from '../StaffPortal.module.css'

const BUNDLES_CAT = '__bundles__'

// Konobarski unos narudžbe — Korak 1 (izbor stola) → Korak 2 (stavke) → Pošalji.
// Reuse: orders+order_items kroz RPC waiter_submit_order. Spec: docs/spec-konobarski-unos-narudzbe.md
export default function NewOrderView({ restaurant, onDone }) {
  const { t, i18n } = useTranslation('staffportal')
  const restaurantId = restaurant?.id
  const money = (a) => formatMoney(a, restaurant?.currency, i18n.language)
  const { categories, itemsByCategory, loading: menuLoading } = useMenuData(restaurantId)

  const [step, setStep]         = useState('table')   // 'table' | 'menu'
  const [tables, setTables]     = useState([])
  const [openTables, setOpenTables] = useState(new Set())
  const [tablesLoading, setTablesLoading] = useState(true)
  const [selected, setSelected] = useState(null)      // { number, label }
  const [mode, setMode]         = useState('auto')     // 'auto' | 'new'
  const [activeCat, setActiveCat] = useState(null)
  const [cart, setCart]         = useState([])         // [{id,name,price,qty,category_id} | {is_bundle,components}]
  const [sending, setSending]   = useState(false)
  const [bundles, setBundles]   = useState([])         // aktivni paketi sa komponentama (cijena+PDV)

  useEffect(() => {
    if (!restaurantId) return
    let cancelled = false
    ;(async () => {
      const [{ data: bs }, { data: bis }] = await Promise.all([
        supabase.from('menu_bundles').select('*').eq('restaurant_id', restaurantId).eq('is_active', true).order('sort_order'),
        supabase.from('menu_bundle_items')
          .select('bundle_id, quantity, menu_items(id,name,price,vat_rate_key,category_id,categories(vat_rate_key))')
          .eq('restaurant_id', restaurantId),
      ])
      if (cancelled) return
      const byBundle = {}
      for (const r of bis || []) {
        const mi = r.menu_items
        if (!mi) continue
        ;(byBundle[r.bundle_id] ||= []).push({
          menu_item_id: mi.id, name: mi.name, unit_price: Number(mi.price) || 0, quantity: r.quantity,
          category_id: mi.category_id, vat_rate_key: mi.vat_rate_key || mi.categories?.vat_rate_key || null,
        })
      }
      const live = (bs || []).filter(b => isPromoLive(b) && (byBundle[b.id] || []).length)
        .map(b => ({ ...b, components: byBundle[b.id] || [] }))
      setBundles(live)
    })()
    return () => { cancelled = true }
  }, [restaurantId])

  useEffect(() => {
    if (!restaurantId) return
    let cancelled = false
    setTablesLoading(true)
    Promise.all([
      // Konobar bira sto iz AKTIVNOG layouta (live unos narudžbe — string-match table_number).
      supabase.from('tables').select('id,number,label,seats,status, table_layouts!inner(is_active)')
        .eq('restaurant_id', restaurantId).eq('table_layouts.is_active', true).order('number'),
      supabase.from('orders').select('table_number')
        .eq('restaurant_id', restaurantId).neq('status', 'closed'),
    ]).then(([{ data: tbs }, { data: ords }]) => {
      if (cancelled) return
      setTables(tbs || [])
      setOpenTables(new Set((ords || []).map(o => o.table_number)))
      setTablesLoading(false)
    })
    return () => { cancelled = true }
  }, [restaurantId])

  useEffect(() => {
    if (categories.length && !activeCat) setActiveCat(categories[0].id)
  }, [categories, activeCat])

  const tableNo  = selected ? String(selected.number) : null
  const isAppend = tableNo != null && openTables.has(tableNo) && mode === 'auto'

  const pickTable = (tbl, asNew = false) => { setSelected(tbl); setMode(asNew ? 'new' : 'auto'); setStep('menu') }

  const qtyOf = (id) => cart.find(c => c.id === id)?.qty || 0
  const addItem = (it) => setCart(prev => {
    const ex = prev.find(c => c.id === it.id)
    if (ex) return prev.map(c => c.id === it.id ? { ...c, qty: c.qty + 1 } : c)
    return [...prev, { id: it.id, name: it.name, price: Number(it.price) || 0, qty: 1, category_id: it.category_id }]
  })
  const decItem = (id) => setCart(prev =>
    prev.flatMap(c => c.id !== id ? [c] : (c.qty <= 1 ? [] : [{ ...c, qty: c.qty - 1 }])))
  const addBundle = (b) => setCart(prev => {
    const ex = prev.find(c => c.id === b.id)
    if (ex) return prev.map(c => c.id === b.id ? { ...c, qty: c.qty + 1 } : c)
    return [...prev, { id: b.id, name: b.name, price: Number(b.bundle_price) || 0, qty: 1, category_id: null, is_bundle: true, components: b.components }]
  })

  const total = cartTotal(cart)
  const count = cart.reduce((sum, c) => sum + c.qty, 0)

  const send = async () => {
    if (!cart.length || sending) return
    setSending(true)
    // Paket → komponente (puna cijena) + negativna stavka popusta po PDV grupi.
    const items = []
    for (const c of cart) {
      if (c.is_bundle) {
        const comps = c.components || []
        for (const comp of comps) {
          items.push({
            menu_item_id: comp.menu_item_id, name: comp.name, price: comp.unit_price,
            quantity: comp.quantity * c.qty, category_id: comp.category_id,
            bundle_id: c.id, is_bundle_component: true,
          })
        }
        const grossLines = comps.map(x => ({ vat_rate_key: x.vat_rate_key, gross_cents: Math.round(x.unit_price * 100) * x.quantity * c.qty }))
        const bundleTotalCents = Math.round(c.price * 100) * c.qty
        const origCents = grossLines.reduce((sm, g) => sm + g.gross_cents, 0)
        const pct = origCents > 0 ? Math.round((1 - bundleTotalCents / origCents) * 100) : 0
        for (const d of allocateBundleDiscount(grossLines, bundleTotalCents)) {
          items.push({
            menu_item_id: null, name: `Popust: ${c.name}${pct > 0 ? ` (−${pct}%)` : ''}`,
            price: -(d.discount_cents / 100), quantity: 1, category_id: null,
            bundle_id: c.id, is_bundle_component: false, vat_rate_key: d.vat_rate_key,
          })
        }
      } else {
        items.push({ menu_item_id: c.id, name: c.name, price: c.price, quantity: c.qty, category_id: c.category_id })
      }
    }
    const { error } = await supabase.rpc('waiter_submit_order', {
      p_restaurant_id: restaurantId,
      p_table: tableNo,
      p_items: items,
      p_mode: mode,
    })
    setSending(false)
    if (error) { toast.error(t('orderSendErr')); return }
    toast.success(t('orderSentToast'))
    onDone?.()
  }

  // ── Korak 1: izbor stola ──────────────────────────────────────────
  if (step === 'table') return (
    <div>
      <div className={s.noHeader}>
        <button className={s.noBack} onClick={onDone} aria-label="←">←</button>
        <div className={s.noTitle}>{t('pickTable')}</div>
      </div>
      <div className={s.noStepHint}>{t('stepTableOf')}</div>
      {tablesLoading ? <div className={s.loadingInline}>{t('loading')}</div> : (
        <div className={s.tableGrid}>
          {tables.map(tbl => {
            const busy = openTables.has(String(tbl.number))
            return (
              <div key={tbl.id} className={`${s.tableCard} ${busy ? s.tableCardBusy : ''}`}>
                <button className={s.tableCardMain} onClick={() => pickTable(tbl, false)}>
                  <span className={s.tableCardNum}>{tbl.label || tbl.number}</span>
                  <span className={busy ? s.tableTagBusy : s.tableTagFree}>
                    {busy ? t('tableBusy') : t('tableFree')}
                  </span>
                </button>
                {busy && (
                  <button className={s.tableNewSep} onClick={() => pickTable(tbl, true)}>
                    + {t('newSeparateOrder')}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // ── Korak 2: unos stavki ──────────────────────────────────────────
  const catItems = activeCat ? (itemsByCategory[activeCat] || []) : []
  return (
    <div>
      <div className={s.noHeader}>
        <button className={s.noBack} onClick={() => setStep('table')} aria-label="←">←</button>
        <div className={s.noTitle}>
          {t('table')} {selected?.label || selected?.number}
          {isAppend && <span className={s.noAppendBadge}> · {t('appendToOrder')}</span>}
        </div>
      </div>
      {menuLoading ? <div className={s.loadingInline}>{t('loading')}</div> : (
        <>
          <div className={s.catPills}>
            {bundles.length > 0 && (
              <button
                className={`${s.catPill} ${activeCat === BUNDLES_CAT ? s.catPillActive : ''}`}
                onClick={() => setActiveCat(BUNDLES_CAT)}>
                🎁 {t('bundlesTab')}
              </button>
            )}
            {categories.map(c => (
              <button key={c.id}
                className={`${s.catPill} ${activeCat === c.id ? s.catPillActive : ''}`}
                onClick={() => setActiveCat(c.id)}>
                {c.icon ? `${c.icon} ` : ''}{c.name}
              </button>
            ))}
          </div>
          <div className={s.noItemList}>
            {activeCat === BUNDLES_CAT ? (
              bundles.map(b => {
                const q = qtyOf(b.id)
                return (
                  <div key={b.id} className={s.noItemRow}>
                    <div className={s.noItemInfo}>
                      <span className={s.noItemName}>🎁 {b.name}</span>
                      <span className={s.noItemPrice}>{money(Number(b.bundle_price) || 0)}</span>
                    </div>
                    {q === 0 ? (
                      <button className={s.noAddBtn} onClick={() => addBundle(b)} aria-label="+">+</button>
                    ) : (
                      <div className={s.stepper}>
                        <button className={s.stepBtn} onClick={() => decItem(b.id)} aria-label="−">−</button>
                        <span className={s.stepQty}>{q}</span>
                        <button className={s.stepBtn} onClick={() => addBundle(b)} aria-label="+">+</button>
                      </div>
                    )}
                  </div>
                )
              })
            ) : catItems.length === 0 ? (
              <div className={s.empty}><div className={s.emptyText}>{t('noMenuItems')}</div></div>
            ) : catItems.map(it => {
              const q = qtyOf(it.id)
              return (
                <div key={it.id} className={s.noItemRow}>
                  <div className={s.noItemInfo}>
                    <span className={s.noItemName}>{it.emoji ? `${it.emoji} ` : ''}{it.name}</span>
                    <span className={s.noItemPrice}>{money(Number(it.price) || 0)}</span>
                  </div>
                  {q === 0 ? (
                    <button className={s.noAddBtn} onClick={() => addItem(it)} aria-label="+">+</button>
                  ) : (
                    <div className={s.stepper}>
                      <button className={s.stepBtn} onClick={() => decItem(it.id)} aria-label="−">−</button>
                      <span className={s.stepQty}>{q}</span>
                      <button className={s.stepBtn} onClick={() => addItem(it)} aria-label="+">+</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
      {count > 0 && (
        <button className={s.cartBar} onClick={send} disabled={sending}>
          <span className={s.cartBarLeft}>
            <span className={s.cartBarIcon}>🛒</span>
            <span className={s.cartBarLabel}>{sending ? '…' : t('sendOrder')}</span>
            <span className={s.cartBarCount}>{count}</span>
          </span>
          <span className={s.cartBarTotal}>{money(total)}</span>
        </button>
      )}
    </div>
  )
}
