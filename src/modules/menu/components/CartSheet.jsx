import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useCart } from '../../../context/CartContext'
import styles from './CartSheet.module.css'

export default function CartSheet({ restaurant, onClose, onOrderPlaced }) {
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

    if (error) { setPlacing(false); alert('Greška pri slanju narudžbe.'); return }

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

  const STATUS_LABELS = {
    received:  { label: 'Narudžba primljena', icon: '✓', color: '#1D9E75', desc: 'Konobar je obaviješten.' },
    preparing: { label: 'U pripremi',         icon: '⏳', color: '#BA7517', desc: 'Kuhinja priprema vaša jela.' },
    ready:     { label: 'Gotovo!',            icon: '🍽️', color: '#1D9E75', desc: 'Konobar donosi narudžbu.' },
    served:    { label: 'Servirano',          icon: '✓✓', color: '#534AB7', desc: 'Prijatno! Dobar tek.' },
    closed:    { label: 'Zatvoreno',          icon: '✓',  color: '#888780', desc: 'Narudžba je zatvorena.' },
  }

  const STEPS = ['received', 'preparing', 'ready', 'served']

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            {step === 'cart' && `Korpa (${items.length})`}
            {step === 'table' && 'Broj stola'}
            {step === 'tracking' && 'Status narudžbe'}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* KORPA */}
        {step === 'cart' && (
          <div className={styles.body}>
            {items.length === 0 ? (
              <div className={styles.emptyCart}>
                <div className={styles.emptyIcon}>🛒</div>
                <div className={styles.emptyText}>Korpa je prazna</div>
                <div className={styles.emptyDesc}>Dodajte jela iz menija</div>
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
                          placeholder="Napomena (opcionalno)"
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
                  <span>Ukupno</span>
                  <span className={styles.totalAmount}>€{total.toFixed(2)}</span>
                </div>
                <button
                  className={styles.orderBtn}
                  style={{ background: restaurant?.color || '#0d7a52' }}
                  onClick={() => tableNumber ? placeOrder() : setStep('table')}
                >
                  Naruči →
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
              <div className={styles.tableTitle}>Koji je broj vašeg stola?</div>
              <div className={styles.tableDesc}>Narudžba će biti dostavljena na vaš sto.</div>
              <input
                className={styles.tableInput}
                type="text"
                placeholder="npr. 4 ili Terasa 2"
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
                {placing ? 'Slanje...' : 'Potvrdi narudžbu →'}
              </button>
              <button className={styles.backBtn} onClick={() => setStep('cart')}>← Nazad</button>
            </div>
          </div>
        )}

        {/* PRAĆENJE */}
        {step === 'tracking' && order && (
          <div className={styles.body}>
            <div className={styles.trackingHeader}>
              <div
                className={styles.trackingIcon}
                style={{ background: STATUS_LABELS[orderStatus]?.color + '20', color: STATUS_LABELS[orderStatus]?.color }}
              >
                {STATUS_LABELS[orderStatus]?.icon}
              </div>
              <div className={styles.trackingStatus}>{STATUS_LABELS[orderStatus]?.label}</div>
              <div className={styles.trackingDesc}>{STATUS_LABELS[orderStatus]?.desc}</div>
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
              <span>Primljeno</span>
              <span>Priprema</span>
              <span>Gotovo</span>
              <span>Servirano</span>
            </div>

            <div className={styles.orderSummary}>
              <div className={styles.summaryTitle}>Vaša narudžba · Sto {order.table_number}</div>
              <div className={styles.summaryTotal}>€{parseFloat(order.total).toFixed(2)}</div>
            </div>

            <button className={styles.closeOrderBtn} onClick={onClose}>
              Zatvori
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
