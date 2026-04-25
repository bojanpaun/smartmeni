// src/modules/guests/pages/OrderTrackerPage.jsx
// Dostupno na: /:slug/narudzba/:orderId

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { getTemplate } from '../../../lib/templates'
import styles from './OrderTrackerPage.module.css'

const STATUS_STEPS = [
  { key: 'received',  icon: '✅', label: 'Narudžba primljena',  labelEn: 'Order received',  desc: 'Vaša narudžba je primljena i čeka potvrdu.',          descEn: 'Your order has been received and awaits confirmation.' },
  { key: 'preparing', icon: '👨‍🍳', label: 'U pripremi',         labelEn: 'Being prepared',   desc: 'Kuhinja priprema vašu narudžbu.',                       descEn: 'The kitchen is preparing your order.' },
  { key: 'ready',    icon: '🔔', label: 'Gotovo!',             labelEn: 'Ready!',            desc: 'Vaša narudžba je gotova. Konobar dolazi.',              descEn: 'Your order is ready. The waiter is on the way.' },
  { key: 'served',   icon: '🍽️', label: 'Servirano',           labelEn: 'Served',            desc: 'Prijatno! Narudžba je servisirana na vaš sto.',         descEn: 'Enjoy your meal! Order has been served to your table.' },
]

const STATUS_INDEX = Object.fromEntries(STATUS_STEPS.map((s, i) => [s.key, i]))

export default function OrderTrackerPage() {
  const { slug, orderId } = useParams()
  const navigate = useNavigate()
  const [restaurant, setRestaurant] = useState(null)
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [lang, setLang] = useState('sr')
  const channelRef = useRef(null)

  const isEn = lang === 'en'

  const loadData = useCallback(async () => {
    // Učitaj restoran — koristi samo sigurne kolone
    const { data: rest, error: restErr } = await supabase
      .from('restaurants')
      .select('id, name, slug, logo_url, color, template')
      .eq('slug', slug)
      .single()

    if (!rest) { setNotFound(true); setLoading(false); return }
    setRestaurant(rest)

    // Učitaj narudžbu
    const { data: ord, error: ordErr } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .eq('restaurant_id', rest.id)
      .single()

    if (!ord) { setNotFound(true); setLoading(false); return }
    setOrder(ord)
    setItems(ord.order_items || [])
    setLoading(false)

    // Supabase Realtime — praćenje promjene statusa
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    const ch = supabase
      .channel(`order-tracker-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      }, (payload) => {
        setOrder(prev => ({ ...prev, ...payload.new }))
        // Obriši aktivnu narudžbu iz sessionStorage kad je isporučena/zatvorena
        if (payload.new.status === 'served' || payload.new.status === 'closed') {
          try { sessionStorage.removeItem(`sm_order_${slug}`) } catch {}
        }
      })
      .subscribe()
    channelRef.current = ch
  }, [slug, orderId])

  useEffect(() => {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    loadData()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [loadData])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans,sans-serif', color: '#8a9e96' }}>
      Učitavanje narudžbe...
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans,sans-serif', gap: 12, padding: 24 }}>
      <div style={{ fontSize: 48 }}>🍽️</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2e26' }}>Narudžba nije pronađena</div>
      <div style={{ color: '#8a9e96', textAlign: 'center' }}>Provjerite link ili kontaktirajte osoblje.</div>
      <button
        onClick={() => navigate(`/${slug}`)}
        style={{ marginTop: 12, padding: '10px 22px', borderRadius: 10, border: 'none', background: '#0d7a52', color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }}
      >
        ← Nazad na meni
      </button>
    </div>
  )

  const tpl = getTemplate(restaurant?.template)
  const currentStep = STATUS_INDEX[order.status] ?? -1
  const isClosed = order.status === 'closed'
  const isServed = order.status === 'served'
  const isDone = isClosed || isServed

  const total = items.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0)

  return (
    <div className={styles.pageWrapper}>
      <div
        className={styles.page}
        style={{
          '--tpl-brand': tpl.brand,
          '--tpl-brand-light': tpl.catBg,
          '--tpl-cat-color': tpl.catColor,
        }}
      >
        {/* HEADER */}
        <div className={styles.header} style={{ background: tpl.brand }}>
          <div className={styles.headerTop}>
            <button className={styles.backBtn} onClick={() => navigate(`/${slug}`)}>
              ← {isEn ? 'Menu' : 'Meni'}
            </button>
            <button className={styles.langToggle} onClick={() => setLang(isEn ? 'sr' : 'en')}>
              {isEn ? 'SR' : 'EN'}
            </button>
          </div>
          <div className={styles.restInfo}>
            <div className={styles.restLogo}>
              {restaurant.logo_url
                ? <img src={restaurant.logo_url} alt={restaurant.name} className={styles.restLogoImg} />
                : restaurant.name[0]
              }
            </div>
            <div>
              <div className={styles.restName}>{restaurant.name}</div>
              <div className={styles.restSub}>{isEn ? 'Order tracking' : 'Praćenje narudžbe'}</div>
            </div>
          </div>
        </div>

        {/* ORDER ID */}
        <div className={styles.orderIdBar}>
          <span className={styles.orderIdLabel}>{isEn ? 'Order' : 'Narudžba'} #</span>
          <span className={styles.orderIdVal}>{orderId.slice(-8).toUpperCase()}</span>
          {order.table_number && (
            <span className={styles.tableTag}>🪑 {order.table_number}</span>
          )}
        </div>

        {/* STEPPER */}
        {!isClosed && (
          <div className={styles.stepperCard}>
            <div className={styles.stepperTitle}>
              {isEn ? 'Order status' : 'Status narudžbe'}
              <span className={styles.liveDot} title={isEn ? 'Live updates' : 'Ažuriranje uživo'} />
            </div>
            <div className={styles.stepper}>
              {STATUS_STEPS.map((step, i) => {
                const done = i < currentStep
                const active = i === currentStep
                const future = i > currentStep
                return (
                  <div key={step.key} className={styles.stepRow}>
                    {/* Connector line */}
                    {i > 0 && (
                      <div className={`${styles.connector} ${done || active ? styles.connectorDone : ''}`} />
                    )}
                    <div className={`${styles.step} ${active ? styles.stepActive : ''} ${done ? styles.stepDone : ''} ${future ? styles.stepFuture : ''}`}>
                      <div className={`${styles.stepDot} ${active ? styles.stepDotActive : ''} ${done ? styles.stepDotDone : ''}`}>
                        {done ? '✓' : step.icon}
                      </div>
                      <div className={styles.stepInfo}>
                        <div className={styles.stepLabel}>
                          {isEn ? step.labelEn : step.label}
                          {active && <span className={styles.stepNow}>{isEn ? 'NOW' : 'SADA'}</span>}
                        </div>
                        {active && (
                          <div className={styles.stepDesc}>
                            {isEn ? step.descEn : step.desc}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Animovani progress */}
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${Math.min(100, ((currentStep + 1) / STATUS_STEPS.length) * 100)}%`,
                  background: tpl.brand,
                }}
              />
            </div>
          </div>
        )}

        {/* ZATVORENA NARUDŽBA */}
        {isClosed && (
          <div className={styles.closedCard}>
            {order.rejection_message ? (
              <>
                <div className={styles.closedIcon}>ℹ️</div>
                <div className={styles.closedTitle}>{isEn ? 'Order cancelled' : 'Narudžba otkazana'}</div>
                <div className={styles.rejectionMsg}>{order.rejection_message}</div>
              </>
            ) : (
              <>
                <div className={styles.closedIcon}>🧾</div>
                <div className={styles.closedTitle}>{isEn ? 'Order closed' : 'Narudžba zatvorena'}</div>
                <div className={styles.closedDesc}>{isEn ? 'Thank you for dining with us!' : 'Hvala što ste jeli kod nas!'}</div>
              </>
            )}
          </div>
        )}

        {/* STAVKE NARUDŽBE */}
        <div className={styles.itemsCard}>
          <div className={styles.itemsTitle}>{isEn ? 'Your order' : 'Vaša narudžba'}</div>
          {items.map(item => (
            <div key={item.id} className={styles.orderItem}>
              <div className={styles.orderItemName}>{item.name}</div>
              <div className={styles.orderItemQty}>×{item.quantity}</div>
              <div className={styles.orderItemPrice}>€{(parseFloat(item.price) * item.quantity).toFixed(2)}</div>
            </div>
          ))}
          <div className={styles.orderTotal}>
            <span>{isEn ? 'Total' : 'Ukupno'}</span>
            <span>€{total.toFixed(2)}</span>
          </div>
        </div>

        {/* CALL TO ACTION */}
        {isDone && (
          <button
            className={styles.newOrderBtn}
            style={{ background: tpl.brand }}
            onClick={() => navigate(`/${slug}`)}
          >
            {isEn ? '🍽️ New order' : '🍽️ Nova narudžba'}
          </button>
        )}

        {/* LINKOVI NA DNU */}
        <div className={styles.menuLinkWrap}>
          <button className={styles.menuLink} onClick={() => navigate(`/${slug}`)}>
            ← {isEn ? 'Back to menu' : 'Pogledajte meni'}
          </button>
          <button className={styles.menuLink} onClick={() => navigate(`/${slug}/profil`)}>
            👤 {isEn ? 'My profile' : 'Moj profil'}
          </button>
        </div>

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
