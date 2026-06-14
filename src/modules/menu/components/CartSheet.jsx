import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { useCart } from '../../../context/CartContext'
import styles from './CartSheet.module.css'

export default function CartSheet({ restaurant, onClose, onOrderPlaced }) {
  const { t } = useTranslation('menu')
  const { items, removeItem, updateQuantity, updateNote, clearCart, total, tableNumber, setTableNumber } = useCart()
  const [step, setStep] = useState('cart') // cart | table | confirm | tracking
  const [order, setOrder] = useState(null)
  const [placing, setPlacing] = useState(false)
  const [orderStatus, setOrderStatus] = useState('received')

  const placeOrder = async () => {
    if (!tableNumber.trim()) { setStep('table'); return }
    setPlacing(true)

    const { data: newOrder, error } = await supabase
      .from('orders')
      .insert({
        restaurant_id: restaurant.id,
        table_number: tableNumber,
        total: parseFloat(total.toFixed(2)),
        status: 'received',
      })
      .select()
      .single()

    if (error) { setPlacing(false); alert(t('cartOrderErr')); return }

    await supabase.from('order_items').insert(
      items.map(item => ({
        order_id: newOrder.id,
        menu_item_id: item.id,
        restaurant_id: restaurant.id,
        name: item.name,
        price: parseFloat(item.price),
        quantity: item.quantity,
        note: item.note || '',
      }))
    )

    setOrder(newOrder)
    setOrderStatus('received')
    clearCart()
    setPlacing(false)
    setStep('tracking')

    // Realtime praćenje statusa
    const channel = supabase
      .channel(`order-${newOrder.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${newOrder.id}`,
      }, (payload) => {
        setOrderStatus(payload.new.status)
        if (payload.new.status === 'closed') {
          supabase.removeChannel(channel)
        }
      })
      .subscribe()

    if (onOrderPlaced) onOrderPlaced(newOrder)
  }

  // Status → ikona/boja (data) + prevedeni label/desc.
  const STATUS_META = {
    received:  { icon: '✓',   color: '#1D9E75', labelKey: 'cartStReceived',  descKey: 'cartStReceivedDesc' },
    preparing: { icon: '⏳',  color: '#BA7517', labelKey: 'cartStPreparing', descKey: 'cartStPreparingDesc' },
    ready:     { icon: '🍽️',  color: '#1D9E75', labelKey: 'cartStReady',     descKey: 'cartStReadyDesc' },
    served:    { icon: '✓✓',  color: '#534AB7', labelKey: 'cartStServed',    descKey: 'cartStServedDesc' },
    closed:    { icon: '✓',   color: '#888780', labelKey: 'cartStClosed',    descKey: 'cartStClosedDesc' },
  }
  const meta = STATUS_META[orderStatus]

  const STEPS = ['received', 'preparing', 'ready', 'served']

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            {step === 'cart' && t('cartTitleN', { n: items.length })}
            {step === 'table' && t('cartTableTitle')}
            {step === 'tracking' && t('cartTrackingTitle')}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* KORPA */}
        {step === 'cart' && (
          <div className={styles.body}>
            {items.length === 0 ? (
              <div className={styles.emptyCart}>
                <div className={styles.emptyIcon}>🛒</div>
                <div className={styles.emptyText}>{t('cartEmpty')}</div>
                <div className={styles.emptyDesc}>{t('cartEmptyDesc')}</div>
              </div>
            ) : (
              <>
                <div className={styles.itemList}>
                  {items.map(item => (
                    <div key={item.id} className={styles.cartItem}>
                      <div className={styles.cartItemEmoji}>{item.emoji}</div>
                      <div className={styles.cartItemBody}>
                        <div className={styles.cartItemName}>{item.name}</div>
                        <div className={styles.cartItemPrice}>€{(parseFloat(item.price) * item.quantity).toFixed(2)}</div>
                        <input
                          className={styles.noteInput}
                          placeholder={t('cartNotePh')}
                          value={item.note}
                          onChange={e => updateNote(item.id, e.target.value)}
                        />
                      </div>
                      <div className={styles.qtyControl}>
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>−</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={styles.totalRow}>
                  <span>{t('cartTotal')}</span>
                  <span className={styles.totalAmount}>€{total.toFixed(2)}</span>
                </div>
                <button
                  className={styles.orderBtn}
                  style={{ background: restaurant?.color || '#0d7a52' }}
                  onClick={() => tableNumber ? placeOrder() : setStep('table')}
                >
                  {t('cartOrder')} →
                </button>
              </>
            )}
          </div>
        )}

        {/* BROJ STOLA */}
        {step === 'table' && (
          <div className={styles.body}>
            <div className={styles.tablePrompt}>
              <div className={styles.tableIcon}>🪑</div>
              <div className={styles.tableTitle}>{t('cartTableQ')}</div>
              <div className={styles.tableDesc}>{t('cartTableDesc')}</div>
              <input
                className={styles.tableInput}
                type="text"
                placeholder={t('cartTablePh')}
                value={tableNumber}
                onChange={e => setTableNumber(e.target.value)}
                autoFocus
              />
              <button
                className={styles.orderBtn}
                style={{ background: restaurant?.color || '#0d7a52' }}
                onClick={placeOrder}
                disabled={!tableNumber.trim() || placing}
              >
                {placing ? t('cartSending') : `${t('cartConfirmOrder')} →`}
              </button>
              <button className={styles.backBtn} onClick={() => setStep('cart')}>← {t('cartBack')}</button>
            </div>
          </div>
        )}

        {/* PRAĆENJE */}
        {step === 'tracking' && order && (
          <div className={styles.body}>
            <div className={styles.trackingHeader}>
              <div
                className={styles.trackingIcon}
                style={{ background: meta?.color + '20', color: meta?.color }}
              >
                {meta?.icon}
              </div>
              <div className={styles.trackingStatus}>{meta && t(meta.labelKey)}</div>
              <div className={styles.trackingDesc}>{meta && t(meta.descKey)}</div>
            </div>

            <div className={styles.progressBar}>
              {STEPS.map((s, i) => (
                <div key={s} className={styles.progressStep}>
                  <div
                    className={styles.progressDot}
                    style={{
                      background: STEPS.indexOf(orderStatus) >= i
                        ? (restaurant?.color || '#0d7a52')
                        : 'var(--color-border-tertiary)'
                    }}
                  />
                  {i < STEPS.length - 1 && (
                    <div
                      className={styles.progressLine}
                      style={{
                        background: STEPS.indexOf(orderStatus) > i
                          ? (restaurant?.color || '#0d7a52')
                          : 'var(--color-border-tertiary)'
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className={styles.progressLabels}>
              <span>{t('cartLblReceived')}</span>
              <span>{t('cartLblPreparing')}</span>
              <span>{t('cartLblReady')}</span>
              <span>{t('cartLblServed')}</span>
            </div>

            <div className={styles.orderSummary}>
              <div className={styles.summaryTitle}>{t('cartYourOrder')} · {t('tableLabel', { n: order.table_number })}</div>
              <div className={styles.summaryTotal}>€{parseFloat(order.total).toFixed(2)}</div>
            </div>

            <button className={styles.closeOrderBtn} onClick={onClose}>
              {t('cartClose')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
