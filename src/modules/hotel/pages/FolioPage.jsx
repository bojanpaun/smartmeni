import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import styles from './Hotel.module.css'

const TYPE_ICON  = { room_charge: '🛏️', restaurant: '🍽️', minibar: '🍷', spa: '💆', other: '📋' }
const TYPE_LABEL_KEYS = { room_charge: 'htTypeRoom', restaurant: 'htTypeRestaurant', minibar: 'htTypeMinibar', spa: 'htTypeSpa', other: 'htTypeOther' }

const EMPTY_ITEM = { description: '', type: 'other', unit_price: '', quantity: 1 }

export default function FolioPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('admin')
  const dl = i18n.language === 'en' ? 'en-US' : 'sr-Latn'
  const { restaurant } = usePlatform()

  const [reservation, setReservation] = useState(null)
  const [folios, setFolios] = useState([])        // svi folji rezervacije (split)
  const [folio, setFolio] = useState(null)        // aktivni folio
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  // Split folio — kreiranje sekundarnog + premještanje stavki
  const [newFolioLabel, setNewFolioLabel] = useState('')
  const [creatingFolio, setCreatingFolio] = useState(false)
  const [movingItemId, setMovingItemId] = useState(null)

  const [addingItem, setAddingItem] = useState(false)
  const [newItem, setNewItem] = useState(EMPTY_ITEM)
  const [saving, setSaving] = useState(false)

  // Retail prodaja (spa proizvodi)
  const [sellingRetail, setSellingRetail] = useState(false)
  const [retailList, setRetailList] = useState([])
  const [retailItemId, setRetailItemId] = useState('')
  const [retailQty, setRetailQty] = useState(1)
  const [retailBusy, setRetailBusy] = useState(false)

  // Minibar zaduženje
  const [chargingMinibar, setChargingMinibar] = useState(false)
  const [minibarList, setMinibarList] = useState([])
  const [minibarItemId, setMinibarItemId] = useState('')
  const [minibarQty, setMinibarQty] = useState(1)
  const [minibarBusy, setMinibarBusy] = useState(false)
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
      toast.success(t('flPaymentReceived'))
      window.history.replaceState({}, '', window.location.pathname)
      load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Učitaj rezervaciju + sve folje; zadrži aktivni folio (ili primarni/prvi).
  const load = async (preferFolioId) => {
    setLoading(true)
    const [{ data: res }, { data: fl }] = await Promise.all([
      supabase.from('hotel_reservations')
        .select('*, rooms(room_number), room_types(name)')
        .eq('id', id).single(),
      supabase.from('folios').select('*').eq('reservation_id', id)
        .order('is_primary', { ascending: false }).order('created_at', { ascending: true }),
    ])
    setReservation(res)
    const list = fl ?? []
    setFolios(list)
    if (list.length) {
      const wanted = preferFolioId ?? folio?.id
      const active = list.find(x => x.id === wanted) ?? list[0]
      setFolio(active)
      await loadDetail(active.id)
    } else {
      setFolio(null); setItems([]); setPaymentTx(null)
    }
    setLoading(false)
  }

  // Stavke + plaćena transakcija za jedan folio
  const loadDetail = async (folioId) => {
    const [{ data: fi }, { data: tx }] = await Promise.all([
      supabase.from('folio_items').select('*').eq('folio_id', folioId)
        .order('created_at', { ascending: true }),
      supabase.from('payment_transactions').select('*')
        .eq('source_type', 'folio').eq('source_id', folioId)
        .eq('status', 'paid').maybeSingle(),
    ])
    setItems(fi ?? [])
    setPaymentTx(tx ?? null)
  }

  // Prebaci aktivni folio (tab)
  const selectFolio = async (f) => {
    if (f.id === folio?.id) return
    setFolio(f); setShowRefund(false); setAddingItem(false)
    setSellingRetail(false); setChargingMinibar(false)
    await loadDetail(f.id)
  }

  // Kreiraj sekundarni (split) folio
  const handleCreateFolio = async () => {
    const label = newFolioLabel.trim()
    if (!label) return toast.error(t('flEnterFolioName'))
    setCreatingFolio(true)
    const { data: newId, error } = await supabase.rpc('create_secondary_folio', {
      p_reservation_id: id, p_label: label,
    })
    setCreatingFolio(false)
    if (error) return toast.error(error.message || t('flCreateFolioErr'))
    setNewFolioLabel('')
    toast.success(t('flFolioCreated', { label }))
    load(newId)
  }

  // Premjesti stavku na drugi folio
  const handleMoveItem = async (item, targetFolioId) => {
    setMovingItemId(null)
    const { error } = await supabase.rpc('move_folio_item', {
      p_item_id: item.id, p_target_folio_id: targetFolioId,
    })
    if (error) return toast.error(error.message || t('flMoveErr'))
    toast.success(t('flItemMoved'))
    load()
  }

  const computedTotal = items.reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0)
  const balance = computedTotal - (parseFloat(folio?.paid_amount) || 0)

  const handleAddItem = async () => {
    if (!newItem.description.trim() || !newItem.unit_price) return toast.error(t('flDescPriceRequired'))
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

    if (error) { toast.error(t('flAddItemErr')); setSaving(false); return }

    await supabase.from('folios').update({
      total_amount: computedTotal + total,
      updated_at: new Date().toISOString(),
    }).eq('id', folio.id)

    toast.success(t('flItemAdded'))
    setNewItem(EMPTY_ITEM)
    setAddingItem(false)
    setSaving(false)
    load()
  }

  const handleDeleteItem = async (item) => {
    if (!confirm(t('flRemoveItemConfirm', { desc: item.description }))) return
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
    if (!retailItemId) return toast.error(t('flSelectProduct'))
    const qty = parseInt(retailQty) || 1
    setRetailBusy(true)
    const { data, error } = await supabase.rpc('sell_retail_to_folio', {
      p_item_id: retailItemId, p_folio_id: folio.id, p_quantity: qty,
    })
    if (error) { toast.error(error.message || t('flSellErr')); setRetailBusy(false); return }
    await supabase.from('folios').update({
      total_amount: computedTotal + (Number(data?.total) || 0),
      updated_at: new Date().toISOString(),
    }).eq('id', folio.id)
    toast.success(t('flProductSold'))
    setRetailBusy(false)
    setSellingRetail(false)
    load()
  }

  // ── Minibar zaduženje na folio ────────────────────────────────
  const openMinibar = async () => {
    setChargingMinibar(true)
    setMinibarItemId(''); setMinibarQty(1)
    const { data } = await supabase
      .from('minibar_items')
      .select('id, name, price')
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .order('name')
    setMinibarList(data ?? [])
  }

  const chargeMinibar = async () => {
    if (!minibarItemId) return toast.error(t('flSelectItem'))
    const it = minibarList.find(m => m.id === minibarItemId)
    if (!it) return
    const qty = parseInt(minibarQty) || 1
    const total = (Number(it.price) || 0) * qty
    setMinibarBusy(true)
    const { error } = await supabase.from('folio_items').insert({
      folio_id:      folio.id,
      restaurant_id: restaurant.id,
      type:          'minibar',
      description:   `${t('htTypeMinibar')}: ${it.name}`,
      quantity:      qty,
      unit_price:    Number(it.price) || 0,
      total_price:   total,
      date:          new Date().toISOString().slice(0, 10),
    })
    if (error) { toast.error(t('flChargeErr')); setMinibarBusy(false); return }
    await supabase.from('folios').update({
      total_amount: computedTotal + total,
      updated_at: new Date().toISOString(),
    }).eq('id', folio.id)
    toast.success(t('flMinibarCharged'))
    setMinibarBusy(false)
    setChargingMinibar(false)
    load()
  }

  const handleCloseFolio = async () => {
    if (!confirm(t('flCloseConfirm'))) return
    await supabase.from('folios').update({ status: 'closed', updated_at: new Date().toISOString() }).eq('id', folio.id)
    toast.success(t('flFolioClosed'))
    load(folio.id)
  }

  const handleReopenFolio = async () => {
    await supabase.from('folios').update({ status: 'open', updated_at: new Date().toISOString() }).eq('id', folio.id)
    toast.success(t('flFolioReopened'))
    load(folio.id)
  }

  const handleRefund = async () => {
    if (!paymentTx) return
    const paidEur = paymentTx.amount_minor / 100
    const inputEur = parseFloat(refundAmount) || paidEur
    if (inputEur <= 0 || inputEur > paidEur) {
      return toast.error(t('flRefundRange', { max: paidEur.toFixed(2) }))
    }
    if (!confirm(t('flRefundConfirm', { amt: inputEur.toFixed(2) }))) return

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
      if (!res.ok) throw new Error(data.error ?? t('flRefundFailed'))
      toast.success(t('flRefundStarted', { eur: data.refundedEur }))
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
    if (balance <= 0) return toast.error(t('flNoBalance'))
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
            description:     t('flFolioGuest', { guest: reservation?.guest_name ?? '' }),
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('flPaymentStartErr'))
      goToPaymentSession(data)
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
          <h1 className={styles.title}>{t('htFolio')}</h1>
          <button className={styles.btnSecondary} onClick={() => navigate(`/admin/hotel/reservations/${id}`)}>← {t('flBackToReservation')}</button>
        </div>
        <div className={styles.empty}><p>{t('flNoFolio')}</p></div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('flFolioGuest', { guest: reservation?.guest_name })}</h1>
          <p className={styles.subtitle}>
            {reservation?.rooms?.room_number ? t('htRoomNum', { num: reservation.rooms.room_number }) : '—'}
            {reservation?.check_in_date && ` · ${new Date(reservation.check_in_date).toLocaleDateString(dl)} – ${new Date(reservation.check_out_date).toLocaleDateString(dl)}`}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={() => navigate(`/admin/hotel/reservations/${id}`)}>← {t('flBackToReservation')}</button>
          <button className={styles.btnSecondary} onClick={() => window.open(`/admin/hotel/reservations/${id}/folio/print?folio=${folio.id}`, '_blank')}>🖨️ {t('flPrintPdf')}</button>
          {folio.status === 'open'
            ? <button className={styles.btnPrimary} onClick={handleCloseFolio}>{t('flCloseFolio')} ✓</button>
            : <button className={styles.btnSecondary} onClick={handleReopenFolio}>{t('flReopen')}</button>
          }
        </div>
      </div>

      {/* Folio tabovi (split) */}
      <div className={styles.folioTabs}>
        {folios.map(f => (
          <button
            key={f.id}
            className={`${styles.folioTab} ${f.id === folio.id ? styles.folioTabActive : ''}`}
            onClick={() => selectFolio(f)}
          >
            {f.is_primary ? '🧾 ' : '📄 '}
            {f.label || (f.is_primary ? t('flMain') : t('htFolio'))}
            {f.status !== 'open' && <span className={styles.folioTabClosed}> ✓</span>}
          </button>
        ))}
        <div className={styles.folioTabNew}>
          <input
            className={styles.input}
            style={{ height: 34, fontSize: 13, maxWidth: 160 }}
            placeholder="Naziv (npr. Firma)"
            value={newFolioLabel}
            onChange={e => setNewFolioLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateFolio() }}
          />
          <button className={styles.btnSecondary} onClick={handleCreateFolio} disabled={creatingFolio}>
            {creatingFolio ? '...' : `+ ${t('htFolio')}`}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className={styles.folioSummary}>
        <div className={styles.folioSummaryItem}>
          <span className={styles.folioSummaryLabel}>{t('htFieldStatus')}</span>
          <span className={`${styles.resBadge} ${folio.status === 'open' ? '' : styles.resBadgeClosed}`}>
            {folio.status === 'open' ? t('flOpen') : t('flClosed')}
          </span>
        </div>
        <div className={styles.folioSummaryItem}>
          <span className={styles.folioSummaryLabel}>{t('flTotal')}</span>
          <span className={styles.folioSummaryVal}>€{computedTotal.toFixed(2)}</span>
        </div>
        <div className={styles.folioSummaryItem}>
          <span className={styles.folioSummaryLabel}>{t('htPayPaid')}</span>
          <span className={styles.folioSummaryVal}>€{parseFloat(folio.paid_amount || 0).toFixed(2)}</span>
        </div>
        <div className={styles.folioSummaryItem}>
          <span className={styles.folioSummaryLabel}>{t('flBalance')}</span>
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
              {payLoading ? t('flRedirecting') : '💳 ' + t('flPayCard') + ' (€' + balance.toFixed(2) + ')'}
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
                💳 {t('flOnlinePaymentLogged')}
              </div>
              <div style={{ fontSize: 13, color: '#78350f', marginTop: 4 }}>
                €{(paymentTx.amount_minor / 100).toFixed(2)} via {paymentTx.provider} · {new Date(paymentTx.created_at).toLocaleDateString(dl)}
              </div>
            </div>
            {!showRefund && (
              <button className={styles.btnSecondary} onClick={() => { setShowRefund(true); setRefundAmount((paymentTx.amount_minor / 100).toFixed(2)) }}>
                ↩ {t('flRefund')}
              </button>
            )}
          </div>

          {showRefund && (
            <div style={{ marginTop: 14, padding: '14px 16px', background: '#fff', borderRadius: 10, border: '1px solid #fde68a' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#374151' }}>
                {t('flRefundAmount', { max: (paymentTx.amount_minor / 100).toFixed(2) })}
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
                  {t('flFullAmount')}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={styles.btnSecondary} onClick={() => setShowRefund(false)}>{t('cancel')}</button>
                <button className={styles.btnPrimary} onClick={handleRefund} disabled={refundLoading}
                  style={{ background: '#b91c1c' }}>
                  {refundLoading ? t('flProcessing') : `↩ ${t('flRefundBtn', { amt: parseFloat(refundAmount || 0).toFixed(2) })}`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Items */}
      <div className={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 className={styles.sectionTitle} style={{ margin: 0 }}>{t('flItems')}</h3>
          {folio.status === 'open' && !addingItem && !sellingRetail && !chargingMinibar && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className={styles.btnSecondary} onClick={openMinibar}>🥤 {t('htTypeMinibar')}</button>
              <button className={styles.btnSecondary} onClick={openRetail}>🛍️ {t('flSellProduct')}</button>
              <button className={styles.btnSecondary} onClick={() => setAddingItem(true)}>+ {t('flAddItem')}</button>
            </div>
          )}
        </div>

        {chargingMinibar && (
          <div style={{ background: 'var(--c-bg-subtle)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>🥤 {t('flMinibarCharge')}</div>
            {minibarList.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>
                {t('flNoMinibarItems')}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 2, minWidth: 180 }}>
                  <label style={{ fontSize: 12, color: 'var(--c-text-medium)' }}>{t('htItemHead')}</label>
                  <select className={styles.input} value={minibarItemId} onChange={e => setMinibarItemId(e.target.value)}>
                    <option value="">{t('flSelect')}</option>
                    {minibarList.map(m => (
                      <option key={m.id} value={m.id}>{m.name} — €{Number(m.price).toFixed(2)}</option>
                    ))}
                  </select>
                </div>
                <div style={{ width: 90 }}>
                  <label style={{ fontSize: 12, color: 'var(--c-text-medium)' }}>{t('flQty')}</label>
                  <input className={styles.input} type="number" min="1" step="1" value={minibarQty} onChange={e => setMinibarQty(e.target.value)} />
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button className={styles.btnSecondary} onClick={() => setChargingMinibar(false)}>{t('cancel')}</button>
              {minibarList.length > 0 && (
                <button className={styles.btnPrimary} onClick={chargeMinibar} disabled={minibarBusy || !minibarItemId}>
                  {minibarBusy ? t('flCharging') : t('flChargeToFolio')}
                </button>
              )}
            </div>
          </div>
        )}

        {sellingRetail && (
          <div style={{ background: 'var(--c-bg-subtle)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>🛍️ {t('flRetailSale')}</div>
            {retailList.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>
                {t('flNoRetail')}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 2, minWidth: 180 }}>
                  <label style={{ fontSize: 12, color: 'var(--c-text-medium)' }}>{t('flProduct')}</label>
                  <select className={styles.input} value={retailItemId} onChange={e => setRetailItemId(e.target.value)}>
                    <option value="">{t('flSelect')}</option>
                    {retailList.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name}{r.brand ? ` (${r.brand})` : ''} — €{Number(r.price).toFixed(2)} · {t('flStock', { n: r.stock_quantity })}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ width: 90 }}>
                  <label style={{ fontSize: 12, color: 'var(--c-text-medium)' }}>{t('flQty')}</label>
                  <input className={styles.input} type="number" min="1" step="1" value={retailQty} onChange={e => setRetailQty(e.target.value)} />
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button className={styles.btnSecondary} onClick={() => setSellingRetail(false)}>{t('cancel')}</button>
              {retailList.length > 0 && (
                <button className={styles.btnPrimary} onClick={sellRetail} disabled={retailBusy || !retailItemId}>
                  {retailBusy ? t('flSelling') : t('flSellToFolio')}
                </button>
              )}
            </div>
          </div>
        )}

        <div className={styles.table}>
          <div className={styles.folioHead}>
            <span>{t('htDateHead')}</span>
            <span>{t('flType')}</span>
            <span>{t('flDesc')}</span>
            <span style={{ textAlign: 'right' }}>{t('htAmount')}</span>
            <span />
          </div>

          {items.length === 0 && (
            <div className={styles.empty} style={{ padding: '28px 20px' }}>
              <p>{t('flNoItems')}</p>
            </div>
          )}

          {items.map(item => (
            <div key={item.id} className={styles.folioRow}>
              <span className={styles.folioDate}>
                {item.date ? new Date(item.date).toLocaleDateString(dl, { day: '2-digit', month: '2-digit' }) : '—'}
              </span>
              <span className={styles.folioType}>
                {TYPE_ICON[item.type] ?? '📋'} {TYPE_LABEL_KEYS[item.type] ? t(TYPE_LABEL_KEYS[item.type]) : item.type}
              </span>
              <span className={styles.folioDesc}>
                {item.description}
                {item.quantity !== 1 && <span className={styles.folioQty}> × {item.quantity}</span>}
              </span>
              <span className={styles.folioAmount}>€{parseFloat(item.total_price).toFixed(2)}</span>
              <span style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
                {folio.status === 'open' && folios.length > 1 && (
                  movingItemId === item.id ? (
                    <select
                      className={styles.input}
                      style={{ height: 30, fontSize: 12, maxWidth: 140 }}
                      defaultValue=""
                      autoFocus
                      onBlur={() => setMovingItemId(null)}
                      onChange={e => e.target.value && handleMoveItem(item, e.target.value)}
                    >
                      <option value="" disabled>{t('flMoveTo')}</option>
                      {folios.filter(f => f.id !== folio.id).map(f => (
                        <option key={f.id} value={f.id}>{f.label || (f.is_primary ? t('flMain') : t('htFolio'))}</option>
                      ))}
                    </select>
                  ) : (
                    <button className={styles.btnIcon} onClick={() => setMovingItemId(item.id)} title={t('flMoveToOther')}>⇄</button>
                  )
                )}
                {folio.status === 'open' && (
                  <button className={styles.btnIcon} onClick={() => handleDeleteItem(item)} title={t('flRemoveItem')}>✕</button>
                )}
              </span>
            </div>
          ))}

          {/* Total row */}
          {items.length > 0 && (
            <div className={styles.folioTotalRow}>
              <span style={{ gridColumn: '1 / 4', textAlign: 'right', fontWeight: 600, color: '#5a7a6a' }}>{t('flTotal')}</span>
              <span className={styles.folioAmount} style={{ fontWeight: 700, fontSize: 15 }}>€{computedTotal.toFixed(2)}</span>
              <span />
            </div>
          )}
        </div>
      </div>

      {/* Add item form */}
      {addingItem && (
        <div className={styles.formSection} style={{ marginTop: 16 }}>
          <h3 className={styles.sectionTitle}>{t('flNewItem')}</h3>
          <div className={styles.formGrid}>
            <label className={styles.formLabel} style={{ gridColumn: '1 / -1' }}>{t('flDesc')} *
              <input className={styles.input} value={newItem.description}
                onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))}
                placeholder="npr. Minibar konzumacija, Usluga transfera..." />
            </label>
            <label className={styles.formLabel}>{t('flType')}
              <select className={styles.input} value={newItem.type}
                onChange={e => setNewItem(p => ({ ...p, type: e.target.value }))}>
                {Object.entries(TYPE_LABEL_KEYS).map(([k, key]) => <option key={k} value={k}>{t(key)}</option>)}
              </select>
            </label>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>{t('flQty')}
                <input className={styles.input} type="number" min={1} step={1}
                  value={newItem.quantity}
                  onChange={e => setNewItem(p => ({ ...p, quantity: e.target.value }))} />
              </label>
              <label className={styles.formLabel}>{t('flPricePerUnit')} *
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
            <button className={styles.btnSecondary} onClick={() => { setAddingItem(false); setNewItem(EMPTY_ITEM) }}>{t('cancel')}</button>
            <button className={styles.btnPrimary} onClick={handleAddItem} disabled={saving}>
              {saving ? t('flAdding') : t('flAddToFolio')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
