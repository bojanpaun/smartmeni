import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import styles from './Hotel.module.css'

const TYPE_ICON  = { room_charge: '🛏️', restaurant: '🍽️', minibar: '🍷', spa: '💆', other: '📋' }
const TYPE_LABEL = { room_charge: 'Soba', restaurant: 'Restoran', minibar: 'Minibar', spa: 'Spa', other: 'Ostalo' }

const EMPTY_ITEM = { description: '', type: 'other', unit_price: '', quantity: 1 }

export default function FolioPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { restaurant } = usePlatform()

  const [reservation, setReservation] = useState(null)
  const [folio, setFolio] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const [addingItem, setAddingItem] = useState(false)
  const [newItem, setNewItem] = useState(EMPTY_ITEM)
  const [saving, setSaving] = useState(false)

  // Retail prodaja (spa proizvodi)
  const [sellingRetail, setSellingRetail] = useState(false)
  const [retailList, setRetailList] = useState([])
  const [retailItemId, setRetailItemId] = useState('')
  const [retailQty, setRetailQty] = useState(1)
  const [retailBusy, setRetailBusy] = useState(false)
  const [paymentProvider, setPaymentProvider] = useState(false)
  const [payLoading, setPayLoading] = useState(false)

  // Refund
  const [paymentTx, setPaymentTx] = useState(null)      // paid transakcija za ovaj folio
  const [showRefund, setShowRefund] = useState(false)
  const [refundAmount, setRefundAmount] = useState('')   // u EUR
  const [refundLoading, setRefundLoading] = useState(false)

  useEffect(() => { load() }, [id])

  // Provjeri ima li hotel aktivan payment provider
  useEffect(() => {
    if (!restaurant?.id) return
    supabase.rpc('has_active_payment_provider', { p_restaurant_id: restaurant.id })
      .then(({ data }) => setPaymentProvider(!!data))
  }, [restaurant?.id])

  // Detektuj povratak nakon uspješnog online plaćanja
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment_success') === '1') {
      toast.success('Plaćanje primljeno! Folio je ažuriran.')
      window.history.replaceState({}, '', window.location.pathname)
      load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = async () => {
    setLoading(true)
    const [{ data: res }, { data: f }] = await Promise.all([
      supabase.from('hotel_reservations')
        .select('*, rooms(room_number), room_types(name)')
        .eq('id', id).single(),
      supabase.from('folios').select('*').eq('reservation_id', id).single(),
    ])
    setReservation(res)
    if (f) {
      setFolio(f)
      const [{ data: fi }, { data: tx }] = await Promise.all([
        supabase.from('folio_items').select('*').eq('folio_id', f.id)
          .order('created_at', { ascending: true }),
        supabase.from('payment_transactions').select('*')
          .eq('source_type', 'folio').eq('source_id', f.id)
          .eq('status', 'paid').maybeSingle(),
      ])
      setItems(fi ?? [])
      setPaymentTx(tx ?? null)
    }
    setLoading(false)
  }

  const computedTotal = items.reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0)
  const balance = computedTotal - (parseFloat(folio?.paid_amount) || 0)

  const handleAddItem = async () => {
    if (!newItem.description.trim() || !newItem.unit_price) return toast.error('Opis i cijena su obavezni')
    setSaving(true)
    const qty   = parseFloat(newItem.quantity) || 1
    const price = parseFloat(newItem.unit_price) || 0
    const total = qty * price

    const { error } = await supabase.from('folio_items').insert({
      folio_id:      folio.id,
      restaurant_id: restaurant.id,
      type:          newItem.type,
      description:   newItem.description,
      quantity:      qty,
      unit_price:    price,
      total_price:   total,
      date:          new Date().toISOString().slice(0, 10),
    })

    if (error) { toast.error('Greška pri dodavanju stavke'); setSaving(false); return }

    await supabase.from('folios').update({
      total_amount: computedTotal + total,
      updated_at: new Date().toISOString(),
    }).eq('id', folio.id)

    toast.success('Stavka dodana')
    setNewItem(EMPTY_ITEM)
    setAddingItem(false)
    setSaving(false)
    load()
  }

  const handleDeleteItem = async (item) => {
    if (!confirm(`Ukloniti stavku "${item.description}"?`)) return
    await supabase.from('folio_items').delete().eq('id', item.id)
    const newTotal = computedTotal - (parseFloat(item.total_price) || 0)
    await supabase.from('folios').update({ total_amount: Math.max(0, newTotal), updated_at: new Date().toISOString() }).eq('id', folio.id)
    load()
  }

  // ── Retail prodaja na folio ───────────────────────────────────
  const openRetail = async () => {
    setSellingRetail(true)
    setRetailItemId(''); setRetailQty(1)
    const { data } = await supabase
      .from('spa_retail_items')
      .select('id, name, brand, price, stock_quantity')
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .gt('stock_quantity', 0)
      .order('name')
    setRetailList(data ?? [])
  }

  const sellRetail = async () => {
    if (!retailItemId) return toast.error('Odaberite proizvod')
    const qty = parseInt(retailQty) || 1
    setRetailBusy(true)
    const { data, error } = await supabase.rpc('sell_retail_to_folio', {
      p_item_id: retailItemId, p_folio_id: folio.id, p_quantity: qty,
    })
    if (error) { toast.error(error.message || 'Greška pri prodaji'); setRetailBusy(false); return }
    await supabase.from('folios').update({
      total_amount: computedTotal + (Number(data?.total) || 0),
      updated_at: new Date().toISOString(),
    }).eq('id', folio.id)
    toast.success('Proizvod prodat na folio')
    setRetailBusy(false)
    setSellingRetail(false)
    load()
  }

  const handleCloseFolio = async () => {
    if (!confirm('Zatvoriti folio? Ovo označava boravak kao završen i plaćen.')) return
    await supabase.from('folios').update({ status: 'closed', updated_at: new Date().toISOString() }).eq('id', folio.id)
    setFolio(f => ({ ...f, status: 'closed' }))
    toast.success('Folio zatvoren')
  }

  const handleReopenFolio = async () => {
    await supabase.from('folios').update({ status: 'open', updated_at: new Date().toISOString() }).eq('id', folio.id)
    setFolio(f => ({ ...f, status: 'open' }))
    toast.success('Folio ponovo otvoren')
  }

  const handleRefund = async () => {
    if (!paymentTx) return
    const paidEur = paymentTx.amount_minor / 100
    const inputEur = parseFloat(refundAmount) || paidEur
    if (inputEur <= 0 || inputEur > paidEur) {
      return toast.error(`Iznos mora biti između €0.01 i €${paidEur.toFixed(2)}`)
    }
    if (!confirm(`Refundovati €${inputEur.toFixed(2)}? Ovo je nepovratna akcija.`)) return

    setRefundLoading(true)
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payments-refund`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_KEY },
          body: JSON.stringify({
            restaurantId: restaurant.id,
            transactionId: paymentTx.id,
            amountMinor: Math.round(inputEur * 100),
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Refund nije uspio')
      toast.success(`Refund €${data.refundedEur} uspješno pokrenuto`)
      setShowRefund(false)
      setRefundAmount('')
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setRefundLoading(false)
    }
  }

  const handleFolioPayment = async () => {
    if (balance <= 0) return toast.error('Nema neplaćenog iznosa.')
    setPayLoading(true)
    const idempotencyKey = `folio-${folio.id}-${Date.now()}`
    const successUrl = `${window.location.origin}/admin/hotel/reservations/${id}/folio?payment_success=1`
    const cancelUrl  = `${window.location.origin}/admin/hotel/reservations/${id}/folio?payment_cancelled=1`
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payments-create-session`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_KEY },
          body: JSON.stringify({
            restaurantId:    restaurant.id,
            sourceType:      'folio',
            sourceId:        folio.id,
            amountMinor:     Math.round(balance * 100),
            currency:        'EUR',
            idempotencyKey,
            successUrl,
            cancelUrl,
            description:     `Folio — ${reservation?.guest_name ?? ''}`,
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Greška pri pokretanju plaćanja')
      window.location.href = data.redirectUrl
    } catch (err) {
      toast.error(err.message)
      setPayLoading(false)
    }
  }

  if (loading) return <LoadingSpinner fullPage />

  if (!folio) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Folio</h1>
          <button className={styles.btnSecondary} onClick={() => navigate(`/admin/hotel/reservations/${id}`)}>← Rezervacija</button>
        </div>
        <div className={styles.empty}><p>Folio nije kreiran za ovu rezervaciju. Check-in kreira folio automatski.</p></div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Folio — {reservation?.guest_name}</h1>
          <p className={styles.subtitle}>
            {reservation?.rooms?.room_number ? `Soba ${reservation.rooms.room_number}` : '—'}
            {reservation?.check_in_date && ` · ${new Date(reservation.check_in_date).toLocaleDateString('sr-Latn')} – ${new Date(reservation.check_out_date).toLocaleDateString('sr-Latn')}`}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={() => navigate(`/admin/hotel/reservations/${id}`)}>← Rezervacija</button>
          <button className={styles.btnSecondary} onClick={() => window.open(`/admin/hotel/reservations/${id}/folio/print`, '_blank')}>🖨️ Štampaj / PDF</button>
          {folio.status === 'open'
            ? <button className={styles.btnPrimary} onClick={handleCloseFolio}>Zatvori folio ✓</button>
            : <button className={styles.btnSecondary} onClick={handleReopenFolio}>Ponovo otvori</button>
          }
        </div>
      </div>

      {/* Summary */}
      <div className={styles.folioSummary}>
        <div className={styles.folioSummaryItem}>
          <span className={styles.folioSummaryLabel}>Status</span>
          <span className={`${styles.resBadge} ${folio.status === 'open' ? '' : styles.resBadgeClosed}`}>
            {folio.status === 'open' ? 'Otvoren' : 'Zatvoren'}
          </span>
        </div>
        <div className={styles.folioSummaryItem}>
          <span className={styles.folioSummaryLabel}>Ukupno</span>
          <span className={styles.folioSummaryVal}>€{computedTotal.toFixed(2)}</span>
        </div>
        <div className={styles.folioSummaryItem}>
          <span className={styles.folioSummaryLabel}>Plaćeno</span>
          <span className={styles.folioSummaryVal}>€{parseFloat(folio.paid_amount || 0).toFixed(2)}</span>
        </div>
        <div className={styles.folioSummaryItem}>
          <span className={styles.folioSummaryLabel}>Balans</span>
          <span className={`${styles.folioSummaryVal} ${balance > 0 ? styles.folioBalanceDue : styles.folioBalancePaid}`}>
            €{balance.toFixed(2)}
          </span>
        </div>
        {folio.status === 'open' && balance > 0 && paymentProvider && (
          <div className={styles.folioSummaryItem}>
            <button
              className={styles.btnPrimary}
              onClick={handleFolioPayment}
              disabled={payLoading}
            >
              {payLoading ? 'Preusmjeravanje...' : '💳 Plati karticu (€' + balance.toFixed(2) + ')'}
            </button>
          </div>
        )}
      </div>

      {/* Refund sekcija — prikazuje se kad postoji plaćena online transakcija */}
      {paymentTx && (
        <div className={styles.section} style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className={styles.sectionTitle} style={{ color: '#92400e', margin: 0 }}>
                💳 Online plaćanje evidentirano
              </div>
              <div style={{ fontSize: 13, color: '#78350f', marginTop: 4 }}>
                €{(paymentTx.amount_minor / 100).toFixed(2)} via {paymentTx.provider} · {new Date(paymentTx.created_at).toLocaleDateString('sr-Latn')}
              </div>
            </div>
            {!showRefund && (
              <button className={styles.btnSecondary} onClick={() => { setShowRefund(true); setRefundAmount((paymentTx.amount_minor / 100).toFixed(2)) }}>
                ↩ Refund
              </button>
            )}
          </div>

          {showRefund && (
            <div style={{ marginTop: 14, padding: '14px 16px', background: '#fff', borderRadius: 10, border: '1px solid #fde68a' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#374151' }}>
                Refund iznos (max €{(paymentTx.amount_minor / 100).toFixed(2)})
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>€</span>
                <input
                  className={styles.input}
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={(paymentTx.amount_minor / 100).toFixed(2)}
                  value={refundAmount}
                  onChange={e => setRefundAmount(e.target.value)}
                  style={{ maxWidth: 120 }}
                />
                <button
                  className={styles.btnSecondary}
                  onClick={() => setRefundAmount((paymentTx.amount_minor / 100).toFixed(2))}
                  style={{ fontSize: 12 }}
                >
                  Puni iznos
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={styles.btnSecondary} onClick={() => setShowRefund(false)}>Odustani</button>
                <button className={styles.btnPrimary} onClick={handleRefund} disabled={refundLoading}
                  style={{ background: '#b91c1c' }}>
                  {refundLoading ? 'Obrađuje se...' : `↩ Refunduj €${parseFloat(refundAmount || 0).toFixed(2)}`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Items */}
      <div className={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 className={styles.sectionTitle} style={{ margin: 0 }}>Stavke</h3>
          {folio.status === 'open' && !addingItem && !sellingRetail && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={styles.btnSecondary} onClick={openRetail}>🛍️ Prodaj proizvod</button>
              <button className={styles.btnSecondary} onClick={() => setAddingItem(true)}>+ Dodaj stavku</button>
            </div>
          )}
        </div>

        {sellingRetail && (
          <div style={{ background: 'var(--c-bg-subtle)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>🛍️ Prodaja retail proizvoda</div>
            {retailList.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>
                Nema proizvoda na zalihi. Dodaj ih u Spa → Retail.
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 2, minWidth: 180 }}>
                  <label style={{ fontSize: 12, color: 'var(--c-text-medium)' }}>Proizvod</label>
                  <select className={styles.input} value={retailItemId} onChange={e => setRetailItemId(e.target.value)}>
                    <option value="">— Odaberi —</option>
                    {retailList.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name}{r.brand ? ` (${r.brand})` : ''} — €{Number(r.price).toFixed(2)} · zaliha {r.stock_quantity}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ width: 90 }}>
                  <label style={{ fontSize: 12, color: 'var(--c-text-medium)' }}>Količina</label>
                  <input className={styles.input} type="number" min="1" step="1" value={retailQty} onChange={e => setRetailQty(e.target.value)} />
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button className={styles.btnSecondary} onClick={() => setSellingRetail(false)}>Odustani</button>
              {retailList.length > 0 && (
                <button className={styles.btnPrimary} onClick={sellRetail} disabled={retailBusy || !retailItemId}>
                  {retailBusy ? 'Prodaja...' : 'Prodaj na folio'}
                </button>
              )}
            </div>
          </div>
        )}

        <div className={styles.table}>
          <div className={styles.folioHead}>
            <span>Datum</span>
            <span>Tip</span>
            <span>Opis</span>
            <span style={{ textAlign: 'right' }}>Iznos</span>
            <span />
          </div>

          {items.length === 0 && (
            <div className={styles.empty} style={{ padding: '28px 20px' }}>
              <p>Nema stavki na foliju.</p>
            </div>
          )}

          {items.map(item => (
            <div key={item.id} className={styles.folioRow}>
              <span className={styles.folioDate}>
                {item.date ? new Date(item.date).toLocaleDateString('sr-Latn', { day: '2-digit', month: '2-digit' }) : '—'}
              </span>
              <span className={styles.folioType}>
                {TYPE_ICON[item.type] ?? '📋'} {TYPE_LABEL[item.type] ?? item.type}
              </span>
              <span className={styles.folioDesc}>
                {item.description}
                {item.quantity !== 1 && <span className={styles.folioQty}> × {item.quantity}</span>}
              </span>
              <span className={styles.folioAmount}>€{parseFloat(item.total_price).toFixed(2)}</span>
              <span>
                {folio.status === 'open' && (
                  <button className={styles.btnIcon} onClick={() => handleDeleteItem(item)} title="Ukloni stavku">✕</button>
                )}
              </span>
            </div>
          ))}

          {/* Total row */}
          {items.length > 0 && (
            <div className={styles.folioTotalRow}>
              <span style={{ gridColumn: '1 / 4', textAlign: 'right', fontWeight: 600, color: '#5a7a6a' }}>Ukupno</span>
              <span className={styles.folioAmount} style={{ fontWeight: 700, fontSize: 15 }}>€{computedTotal.toFixed(2)}</span>
              <span />
            </div>
          )}
        </div>
      </div>

      {/* Add item form */}
      {addingItem && (
        <div className={styles.formSection} style={{ marginTop: 16 }}>
          <h3 className={styles.sectionTitle}>Nova stavka</h3>
          <div className={styles.formGrid}>
            <label className={styles.formLabel} style={{ gridColumn: '1 / -1' }}>Opis *
              <input className={styles.input} value={newItem.description}
                onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))}
                placeholder="npr. Minibar konzumacija, Usluga transfera..." />
            </label>
            <label className={styles.formLabel}>Tip
              <select className={styles.input} value={newItem.type}
                onChange={e => setNewItem(p => ({ ...p, type: e.target.value }))}>
                {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Količina
                <input className={styles.input} type="number" min={1} step={1}
                  value={newItem.quantity}
                  onChange={e => setNewItem(p => ({ ...p, quantity: e.target.value }))} />
              </label>
              <label className={styles.formLabel}>Cijena/kom (€) *
                <input className={styles.input} type="number" min={0} step={0.01}
                  value={newItem.unit_price}
                  onChange={e => setNewItem(p => ({ ...p, unit_price: e.target.value }))}
                  placeholder="0.00" />
              </label>
            </div>
            {newItem.unit_price && newItem.quantity && (
              <div className={styles.totalBox}>
                <span>{newItem.quantity} × €{newItem.unit_price}</span>
                <strong>= €{(parseFloat(newItem.quantity) * parseFloat(newItem.unit_price)).toFixed(2)}</strong>
              </div>
            )}
          </div>
          <div className={styles.formActions}>
            <button className={styles.btnSecondary} onClick={() => { setAddingItem(false); setNewItem(EMPTY_ITEM) }}>Odustani</button>
            <button className={styles.btnPrimary} onClick={handleAddItem} disabled={saving}>
              {saving ? 'Dodavanje...' : 'Dodaj na folio'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
