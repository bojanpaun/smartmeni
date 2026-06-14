// src/modules/guests/pages/OrderTrackerPage.jsx
// Dostupno na: /:slug/narudzba/:orderId

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { getTemplate } from '../../../lib/templates'
import { useContentTranslations } from '../../../lib/useContentTranslations'
import { formatMoney } from '../../../lib/currencies'
import LanguageSwitcher from '../../../i18n/LanguageSwitcher'
import styles from './OrderTrackerPage.module.css'

// Koraci statusa — labela/opis idu kroz i18n ('ordertracker' ns). Ikona ostaje u kodu.
const STATUS_STEPS = [
  { key: 'received',  icon: '✅',   labelKey: 'stReceived',  descKey: 'stReceivedDesc' },
  { key: 'preparing', icon: '👨‍🍳', labelKey: 'stPreparing', descKey: 'stPreparingDesc' },
  { key: 'ready',     icon: '🔔',   labelKey: 'stReady',     descKey: 'stReadyDesc' },
  { key: 'served',    icon: '🍽️',   labelKey: 'stServed',    descKey: 'stServedDesc' },
]

const STATUS_INDEX = Object.fromEntries(STATUS_STEPS.map((s, i) => [s.key, i]))

export default function OrderTrackerPage() {
  const { slug, orderId } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('ordertracker')
  const [restaurant, setRestaurant] = useState(null)
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const channelRef = useRef(null)

  // AI prevod tenant-sadržaja (razlog odbijanja) za aktivni jezik gosta.
  const tr = useContentTranslations(restaurant?.id)

  const loadData = useCallback(async () => {
    // Učitaj restoran — koristi samo sigurne kolone
    const { data: rest } = await supabase
      .from('restaurants')
      .select('id, name, slug, logo_url, color, template, currency')
      .eq('slug', slug)
      .single()

    if (!rest) { setNotFound(true); setLoading(false); return }
    setRestaurant(rest)

    // Učitaj narudžbu
    const { data: ord } = await supabase
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
      {t('loading')}
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans,sans-serif', gap: 12, padding: 24 }}>
      <div style={{ fontSize: 48 }}>🍽️</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2e26' }}>{t('notFoundTitle')}</div>
      <div style={{ color: '#8a9e96', textAlign: 'center' }}>{t('notFoundDesc')}</div>
      <button
        onClick={() => navigate(`/${slug}`)}
        style={{ marginTop: 12, padding: '10px 22px', borderRadius: 10, border: 'none', background: '#0d7a52', color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }}
      >
        ← {t('notFoundBack')}
      </button>
    </div>
  )

  const tpl = getTemplate(restaurant?.template)
  const currentStep = STATUS_INDEX[order.status] ?? -1
  const isClosed = order.status === 'closed'
  const isServed = order.status === 'served'
  const isDone = isClosed || isServed

  const total = items.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0)

  // Razlog odbijanja: izvor je crnogorski (kako ga je konobar odabrao/unio); za
  // ostale jezike prikaži AI prevod ako je stigao, inače fallback na izvor.
  const rejectionText = order.rejection_message
    ? tr('order', order.id, 'rejection_message', order.rejection_message)
    : null

  return (
    <div className={styles.pageWrapper} style={{ background: tpl.pageBg }}>
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
            <button className={styles.backBtn} onClick={() => navigate(`/${slug}`)}>
              ← {t('menu')}
            </button>
            <LanguageSwitcher variant="dark" />
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
              <div className={styles.restSub}>{t('orderTracking')}</div>
            </div>
          </div>
        </div>

        {/* ORDER ID */}
        <div className={styles.orderIdBar}>
          <span className={styles.orderIdLabel}>{t('orderLabel')} #</span>
          <span className={styles.orderIdVal}>{orderId.slice(-8).toUpperCase()}</span>
          {order.table_number && (
            <span className={styles.tableTag}>🪑 {order.table_number}</span>
          )}
        </div>

        {/* STEPPER */}
        {!isClosed && (
          <div className={styles.stepperCard}>
            <div className={styles.stepperTitle}>
              {t('orderStatus')}
              <span className={styles.liveDot} title={t('liveUpdates')} />
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
                          {t(step.labelKey)}
                          {active && <span className={styles.stepNow}>{t('now')}</span>}
                        </div>
                        {active && (
                          <div className={styles.stepDesc}>
                            {t(step.descKey)}
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
            {rejectionText ? (
              <>
                <div className={styles.closedIcon}>ℹ️</div>
                <div className={styles.closedTitle}>{t('cancelledTitle')}</div>
                <div className={styles.rejectionMsg}>{rejectionText}</div>
              </>
            ) : (
              <>
                <div className={styles.closedIcon}>🧾</div>
                <div className={styles.closedTitle}>{t('closedTitle')}</div>
                <div className={styles.closedDesc}>{t('closedDesc')}</div>
              </>
            )}
          </div>
        )}

        {/* STAVKE NARUDŽBE */}
        <div className={styles.itemsCard}>
          <div className={styles.itemsTitle}>{t('yourOrder')}</div>
          {items.map(item => (
            <div key={item.id} className={styles.orderItem}>
              <div className={styles.orderItemName}>{item.name}</div>
              <div className={styles.orderItemQty}>×{item.quantity}</div>
              <div className={styles.orderItemPrice}>{formatMoney(parseFloat(item.price) * item.quantity, restaurant?.currency, i18n.language)}</div>
            </div>
          ))}
          <div className={styles.orderTotal}>
            <span>{t('total')}</span>
            <span>{formatMoney(total, restaurant?.currency, i18n.language)}</span>
          </div>
        </div>

        {/* CALL TO ACTION */}
        {isDone && (
          <button
            className={styles.newOrderBtn}
            style={{ background: tpl.brand }}
            onClick={() => navigate(`/${slug}`)}
          >
            🍽️ {t('newOrder')}
          </button>
        )}

        {/* LINKOVI NA DNU */}
        <div className={styles.menuLinkWrap}>
          <button className={styles.menuLink} onClick={() => navigate(`/${slug}`)}>
            ← {t('backToMenuLink')}
          </button>
          <button className={styles.menuLink} onClick={() => navigate(`/${slug}/profil`)}>
            👤 {t('myProfile')}
          </button>
        </div>

        {/* FOOTER */}
        <div className={styles.footer}>
          <a href="/" className={styles.footerBrand}>
            {t('poweredBy')} <strong>rest.by.me</strong>
          </a>
        </div>
      </div>
    </div>
  )
}
