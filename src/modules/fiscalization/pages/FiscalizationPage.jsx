import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import { formatMoney, fromMinorUnits } from '../../../lib/currencies'
import { useSortable } from '../../../hooks/useSortable'
import SortableHead from '../../../components/shared/SortableHead'
import InvoicePrintModal from '../components/InvoicePrintModal'
import SplitInvoiceModal from '../components/SplitInvoiceModal'
import styles from './FiscalizationPage.module.css'

const RPC_BY_SOURCE = { order: ['create_invoice_from_order', 'p_order_id'], spa: ['create_invoice_from_spa', 'p_appointment_id'], folio: ['create_invoice_from_folio', 'p_folio_id'] }

// FISK addon — „dom" fiskalizacije. Zasad prikazuje stanje (poslovni identitet,
// PDV stope iz tax_config) + placeholdere za faze koje slijede (klasifikacija,
// računi, provajder/poreska uprava). Univerzalno jezgro je dostupno svima; ovaj
// ekran je iza <AddonGuard addonId="fiscalization">.
function IdBadge({ ok, label, value, fallback }) {
  return (
    <div className={styles.idBadge}>
      <span className={ok ? styles.dotOk : styles.dotMiss}>{ok ? '✓' : '○'}</span>
      <div>
        <div className={styles.idLabel}>{label}</div>
        <div className={styles.idValue}>{value || fallback}</div>
      </div>
    </div>
  )
}

const SRC_KEY = { order: 'fiskSrcOrder', folio: 'fiskSrcFolio', spa: 'fiskSrcSpa', booking: 'fiskSrcBooking' }
const STATUS_KEY = { PENDING: 'fiskStatPending', QUEUED: 'fiskStatQueued', FISCALIZED: 'fiskStatFiscalized', FAILED: 'fiskStatFailed' }

export default function FiscalizationPage() {
  const { t, i18n } = useTranslation('admin')
  const dl = i18n.language === 'en' ? 'en-US' : 'sr-Latn'
  const { restaurant, setRestaurant } = usePlatform()
  const [loading, setLoading] = useState(true)
  // PDV stope editor (per-tenant override): taxRows = [{key,label,pct}]
  const [taxRows, setTaxRows] = useState([])
  const [taxCustom, setTaxCustom] = useState(false)
  const [taxDirty, setTaxDirty] = useState(false)
  const [taxSaving, setTaxSaving] = useState(false)
  const [menuStats, setMenuStats] = useState(null) // { total, classified }
  const [invoices, setInvoices] = useState([])
  const [unbilled, setUnbilled] = useState([])
  const [printInvoice, setPrintInvoice] = useState(null)
  const [splitSource, setSplitSource] = useState(null)
  const [issuing, setIssuing] = useState(null) // source_id u toku
  // Filteri + collapse stanje (#1 pretraga, #6 collapsible)
  const [invSearch, setInvSearch] = useState('')
  const [invSource, setInvSource] = useState('all')
  const [invStatus, setInvStatus] = useState('all')
  const [ubSearch, setUbSearch] = useState('')
  const [ubSource, setUbSource] = useState('all')
  const [openUnbilled, setOpenUnbilled] = useState(true)
  const [openInvoices, setOpenInvoices] = useState(true)
  const sortUnbilled = useSortable('occurred_at', 'desc')
  const sortInv = useSortable('issued_at', 'desc')
  const invMoney = (cents, cur) => formatMoney(fromMinorUnits(cents, cur), cur, i18n.language)
  const money = (a) => formatMoney(a, restaurant?.currency, i18n.language)

  const loadInvoices = () => {
    if (!restaurant?.id) return
    supabase.from('invoices')
      .select('id, invoice_number, issued_at, source_type, source_id, total_cents, total_base_cents, total_vat_cents, currency, fiscal_status, corrective_for')
      .eq('restaurant_id', restaurant.id).order('issued_at', { ascending: false }).limit(200)
      .then(({ data }) => setInvoices(data || []))
  }

  // Storniranje (korektivni račun). Original ostaje; samo se kreira ogledalo sa negativnim iznosom.
  const stornoInvoice = async (inv, e) => {
    e.stopPropagation()
    if (!confirm(t('fiskStornoConfirm', { n: inv.invoice_number }))) return
    const reason = window.prompt(t('fiskStornoReason')) ?? null
    const { error } = await supabase.rpc('create_storno_invoice', { p_invoice_id: inv.id, p_reason: reason || null })
    if (error) { toast.error(t('fiskStornoErr')); return }
    toast.success(t('fiskStornoDone'))
    loadInvoices()
  }
  const loadUnbilled = () => {
    if (!restaurant?.id) return
    supabase.rpc('get_unbilled_sources', { p_restaurant_id: restaurant.id, p_limit: 50 })
      .then(({ data }) => setUnbilled(data || []))
  }

  const issueSource = async (src) => {
    const cfg = RPC_BY_SOURCE[src.source_type]
    if (!cfg) return
    setIssuing(src.source_id)
    const { data, error } = await supabase.rpc(cfg[0], { [cfg[1]]: src.source_id })
    setIssuing(null)
    if (error) { toast.error(t('wdInvoiceErr')); return }
    toast.success(t('wdInvoiceIssued', { n: data?.invoice_number || '' }))
    loadUnbilled(); loadInvoices()
  }

  const toggleAuto = async () => {
    const next = !restaurant?.auto_fiscalize
    await supabase.from('restaurants').update({ auto_fiscalize: next }).eq('id', restaurant.id)
    setRestaurant({ ...restaurant, auto_fiscalize: next })
  }

  const ratesToRows = (arr) => (arr || []).map(x => ({ key: x.key, label: x.label, pct: String(+(Number(x.value) * 100).toFixed(2)) }))

  useEffect(() => {
    if (!restaurant?.id) return
    let cancelled = false
    Promise.all([
      supabase.from('restaurants').select('tax_rates').eq('id', restaurant.id).maybeSingle(),
      supabase.from('tax_config').select('rates').eq('country', 'ME').maybeSingle(),
    ]).then(([{ data: r }, { data: tc }]) => {
      if (cancelled) return
      const tenant = Array.isArray(r?.tax_rates) ? r.tax_rates : null
      const country = Array.isArray(tc?.rates) ? tc.rates : []
      setTaxRows(ratesToRows(tenant && tenant.length ? tenant : country))
      setTaxCustom(!!(tenant && tenant.length))
      setTaxDirty(false)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [restaurant?.id])

  // ── PDV stope: uređivanje + snimanje (restaurants.tax_rates) ────────────────
  const taxUpd = (i, field, val) => { setTaxRows(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r)); setTaxDirty(true) }
  const taxAdd = () => { setTaxRows(rows => [...rows, { key: '', label: '', pct: '' }]); setTaxDirty(true) }

  const countRateUsage = async (key) => {
    let total = 0
    for (const tbl of ['menu_items', 'categories', 'spa_services', 'rate_plans', 'minibar_items']) {
      const { count } = await supabase.from(tbl).select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurant.id).eq('vat_rate_key', key)
      total += count || 0
    }
    return total
  }

  const taxRemove = async (i) => {
    const row = taxRows[i]
    if (row.key) {
      const used = await countRateUsage(row.key)
      if (used > 0 && !confirm(t('fiskRateUsedWarn', { key: row.key, n: used }))) return
    }
    setTaxRows(rows => rows.filter((_, idx) => idx !== i)); setTaxDirty(true)
  }

  const taxSave = async () => {
    const cleaned = taxRows.map(r => ({ key: (r.key || '').trim(), label: (r.label || '').trim() || (r.key || '').trim(), value: Number(r.pct) / 100 }))
    if (cleaned.some(r => !r.key || isNaN(r.value) || r.value < 0)) { toast.error(t('fiskRateInvalid')); return }
    const keys = cleaned.map(r => r.key)
    if (new Set(keys).size !== keys.length) { toast.error(t('fiskRateDupKey')); return }
    setTaxSaving(true)
    const { error } = await supabase.from('restaurants').update({ tax_rates: cleaned }).eq('id', restaurant.id)
    setTaxSaving(false)
    if (error) { toast.error(t('saErrPrefix') + error.message); return }
    setRestaurant({ ...restaurant, tax_rates: cleaned })
    setTaxCustom(true); setTaxDirty(false)
    toast.success(t('saved'))
  }

  const taxReset = async () => {
    if (!confirm(t('fiskRateResetConfirm'))) return
    setTaxSaving(true)
    const { error } = await supabase.from('restaurants').update({ tax_rates: null }).eq('id', restaurant.id)
    if (error) { setTaxSaving(false); toast.error(t('saErrPrefix') + error.message); return }
    setRestaurant({ ...restaurant, tax_rates: null })
    const { data: tc } = await supabase.from('tax_config').select('rates').eq('country', 'ME').maybeSingle()
    setTaxRows(ratesToRows(Array.isArray(tc?.rates) ? tc.rates : []))
    setTaxCustom(false); setTaxDirty(false); setTaxSaving(false)
    toast.success(t('saved'))
  }

  // Pregled klasifikacije: koliko KATEGORIJA ima dodijeljenu PDV stopu (jela
  // nasljeđuju iz kategorije; per-jelo je override).
  useEffect(() => {
    if (!restaurant?.id) return
    let cancelled = false
    Promise.all([
      supabase.from('categories').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurant.id),
      supabase.from('categories').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurant.id).not('vat_rate_key', 'is', null),
    ]).then(([all, cls]) => {
      if (cancelled) return
      setMenuStats({ total: all.count || 0, classified: cls.count || 0 })
    })
    return () => { cancelled = true }
  }, [restaurant?.id])

  // Izdati računi + izvori bez računa (za ručno izdavanje).
  useEffect(() => { loadInvoices(); loadUnbilled() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [restaurant?.id])

  const idOk = !!restaurant?.tax_id
  const vatOk = !!restaurant?.vat_number
  const ibanOk = !!restaurant?.iban
  const idComplete = idOk && vatOk

  // ── Filtriranje (client-side nad učitanim setom) ──────────────────────────
  const ubq = ubSearch.trim().toLowerCase()
  const filteredUnbilled = unbilled.filter(s =>
    (ubSource === 'all' || s.source_type === ubSource) &&
    (!ubq || (s.ref_label || '').toLowerCase().includes(ubq)))
  // Originali koji su već stornirani (njihov id je nečiji corrective_for) → ne nudi storno opet.
  const stornoedIds = new Set(invoices.filter(i => i.corrective_for).map(i => i.corrective_for))
  const invq = invSearch.trim().toLowerCase()
  const filteredInvoices = invoices.filter(inv =>
    (invSource === 'all' || inv.source_type === invSource) &&
    (invStatus === 'all' || inv.fiscal_status === invStatus) &&
    (!invq || (inv.invoice_number || '').toLowerCase().includes(invq) || t(SRC_KEY[inv.source_type] || 'fiskSrcOrder').toLowerCase().includes(invq)))

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>🧾 {t('fiskTitle')}</h1>
        <p className={styles.subtitle}>{t('fiskSubtitle')}</p>
      </div>

      {/* Poslovni identitet prodavca */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>{t('fiskBusinessTitle')}</div>
        <div className={styles.idRow}>
          <IdBadge ok={idOk}   label={t('gsTaxId')}     value={restaurant?.tax_id}     fallback={t('fiskNotSet')} />
          <IdBadge ok={vatOk}  label={t('gsVatNumber')} value={restaurant?.vat_number} fallback={t('fiskNotSet')} />
          <IdBadge ok={ibanOk} label={t('gsIban')}      value={restaurant?.iban}       fallback={t('fiskNotSet')} />
        </div>
        {!idComplete && (
          <div className={styles.warn}>
            ⚠️ {t('fiskBusinessMissing')}{' '}
            <Link to="/admin/settings/general" className={styles.link}>{t('fiskBusinessLink')}</Link>
          </div>
        )}
      </div>

      {/* PDV stope — uređivanje po tenantu (override državnih) */}
      <div className={styles.card}>
        <div className={styles.cardTitleRow}>
          <span className={styles.cardTitle}>{t('fiskRatesTitle')}</span>
          <span className={taxCustom ? styles.customTag : styles.soon}>{taxCustom ? t('fiskRatesCustom') : t('fiskRatesDefault')}</span>
        </div>
        <div className={styles.cardHint}>{t('fiskRatesEditHint')}</div>
        {loading ? (
          <div className={styles.muted}>{t('loading')}</div>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('fiskRateKey')}</th>
                  <th>{t('fiskRateLabel')}</th>
                  <th className={styles.right}>{t('fiskRateValue')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {taxRows.map((r, i) => (
                  <tr key={i}>
                    <td><input className={styles.rateInput} value={r.key} onChange={e => taxUpd(i, 'key', e.target.value)} placeholder="STANDARD" /></td>
                    <td><input className={styles.rateInput} value={r.label} onChange={e => taxUpd(i, 'label', e.target.value)} placeholder="Standardna (21%)" /></td>
                    <td className={styles.right}><input className={styles.ratePct} type="number" min="0" step="0.5" value={r.pct} onChange={e => taxUpd(i, 'pct', e.target.value)} /> %</td>
                    <td className={styles.right}><button className={styles.rateDel} onClick={() => taxRemove(i)} title={t('htDelete')}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.rateActions}>
              <button className={styles.splitBtn} onClick={taxAdd}>+ {t('fiskRateAdd')}</button>
              <div style={{ flex: 1 }} />
              {taxCustom && <button className={styles.splitBtn} onClick={taxReset} disabled={taxSaving}>↺ {t('fiskRateReset')}</button>}
              <button className={styles.issueBtn} onClick={taxSave} disabled={taxSaving || !taxDirty}>{taxSaving ? '…' : t('save')}</button>
            </div>
          </>
        )}
      </div>

      {/* Placeholderi — naredne faze */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>{t('fiskClassifyTitle')}</div>
        <div className={styles.cardHint}>{t('fiskClassifyHint')}</div>
        {menuStats && menuStats.total > 0 && (
          <div className={styles.classifyRow}>
            <span className={menuStats.classified >= menuStats.total ? styles.statOk : styles.statWarn}>
              {menuStats.classified} / {menuStats.total}
            </span>
            <span className={styles.classifyLabel}>{t('fiskClassifyMenu')}</span>
            <Link to="/admin/menu" className={styles.link}>{t('fiskClassifyLink')}</Link>
          </div>
        )}
      </div>
      {/* Za izdavanje — nedovršeni izvori bez računa (uvijek dostupno) */}
      <div className={styles.card}>
        <button className={styles.collapseHead} onClick={() => setOpenUnbilled(o => !o)} aria-expanded={openUnbilled}>
          <span className={styles.cardTitle}>{t('fiskUnbilledTitle')} <span className={styles.countTag}>{unbilled.length}</span></span>
          <span className={styles.chevron}>{openUnbilled ? '▾' : '▸'}</span>
        </button>
        {openUnbilled && (<>
          <div className={styles.cardHint}>{t('fiskUnbilledHint')}</div>
          <label className={styles.autoRow}>
            <input type="checkbox" checked={!!restaurant?.auto_fiscalize} onChange={toggleAuto} />
            <span>{t('fiskAutoLabel')}</span>
          </label>
          {unbilled.length > 0 && (
            <div className={styles.filterRow}>
              <input className={styles.searchInput} placeholder={t('fiskSearchUnbilledPh')} value={ubSearch} onChange={e => setUbSearch(e.target.value)} />
              <select className={styles.filterSelect} value={ubSource} onChange={e => setUbSource(e.target.value)}>
                <option value="all">{t('fiskAllSources')}</option>
                <option value="order">{t('fiskSrcOrder')}</option>
                <option value="folio">{t('fiskSrcFolio')}</option>
                <option value="spa">{t('fiskSrcSpa')}</option>
              </select>
            </div>
          )}
          {unbilled.length === 0 ? (
            <div className={styles.muted}>{t('fiskUnbilledEmpty')}</div>
          ) : filteredUnbilled.length === 0 ? (
            <div className={styles.muted}>{t('fiskNoMatch')}</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th><SortableHead col="source_type" label={t('fiskColSource')} sortBy={sortUnbilled.sortBy} sortDir={sortUnbilled.sortDir} onSort={sortUnbilled.onSort} /></th>
                  <th><SortableHead col="occurred_at" label={t('fiskColDate')} sortBy={sortUnbilled.sortBy} sortDir={sortUnbilled.sortDir} onSort={sortUnbilled.onSort} /></th>
                  <th className={styles.right}><SortableHead col="total_amount" label={t('fiskColTotal')} sortBy={sortUnbilled.sortBy} sortDir={sortUnbilled.sortDir} onSort={sortUnbilled.onSort} /></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortUnbilled.sort(filteredUnbilled).map(s => (
                  <tr key={`${s.source_type}-${s.source_id}`}>
                    <td>{t(SRC_KEY[s.source_type] || 'fiskSrcOrder')} · {s.ref_label}</td>
                    <td>{new Date(s.occurred_at).toLocaleDateString(dl, { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                    <td className={styles.right}>{money(s.total_amount)}</td>
                    <td className={styles.right}>
                      <div className={styles.unbilledActions}>
                        <button className={styles.splitBtn} onClick={() => setSplitSource(s)} title={t('fiskSplitTitle')}>
                          ✂️ {t('fiskSplit')}
                        </button>
                        <button className={styles.issueBtn} disabled={issuing === s.source_id} onClick={() => issueSource(s)}>
                          🧾 {issuing === s.source_id ? '…' : t('wdIssueInvoice')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>)}
      </div>

      <div className={styles.card}>
        <button className={styles.collapseHead} onClick={() => setOpenInvoices(o => !o)} aria-expanded={openInvoices}>
          <span className={styles.cardTitle}>{t('fiskInvoicesTitle')} <span className={styles.countTag}>{invoices.length}</span></span>
          <span className={styles.chevron}>{openInvoices ? '▾' : '▸'}</span>
        </button>
        {openInvoices && (<>
          <div className={styles.cardHint}>{t('fiskInvoicesHint')}</div>
          {invoices.length > 0 && (
            <div className={styles.filterRow}>
              <input className={styles.searchInput} placeholder={t('fiskSearchInvoicePh')} value={invSearch} onChange={e => setInvSearch(e.target.value)} />
              <select className={styles.filterSelect} value={invSource} onChange={e => setInvSource(e.target.value)}>
                <option value="all">{t('fiskAllSources')}</option>
                <option value="order">{t('fiskSrcOrder')}</option>
                <option value="folio">{t('fiskSrcFolio')}</option>
                <option value="spa">{t('fiskSrcSpa')}</option>
              </select>
              <select className={styles.filterSelect} value={invStatus} onChange={e => setInvStatus(e.target.value)}>
                <option value="all">{t('fiskAllStatuses')}</option>
                <option value="PENDING">{t('fiskStatPending')}</option>
                <option value="QUEUED">{t('fiskStatQueued')}</option>
                <option value="FISCALIZED">{t('fiskStatFiscalized')}</option>
                <option value="FAILED">{t('fiskStatFailed')}</option>
              </select>
            </div>
          )}
          {invoices.length === 0 ? (
            <div className={styles.muted}>{t('fiskInvEmpty')}</div>
          ) : filteredInvoices.length === 0 ? (
            <div className={styles.muted}>{t('fiskNoMatch')}</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th><SortableHead col="invoice_number" label={t('fiskColNumber')} sortBy={sortInv.sortBy} sortDir={sortInv.sortDir} onSort={sortInv.onSort} /></th>
                  <th><SortableHead col="issued_at" label={t('fiskColDate')} sortBy={sortInv.sortBy} sortDir={sortInv.sortDir} onSort={sortInv.onSort} /></th>
                  <th><SortableHead col="source_type" label={t('fiskColSource')} sortBy={sortInv.sortBy} sortDir={sortInv.sortDir} onSort={sortInv.onSort} /></th>
                  <th className={styles.right}><SortableHead col="total_vat_cents" label={t('fiskColVat')} sortBy={sortInv.sortBy} sortDir={sortInv.sortDir} onSort={sortInv.onSort} /></th>
                  <th className={styles.right}><SortableHead col="total_cents" label={t('fiskColTotal')} sortBy={sortInv.sortBy} sortDir={sortInv.sortDir} onSort={sortInv.onSort} /></th>
                  <th><SortableHead col="fiscal_status" label={t('fiskColStatus')} sortBy={sortInv.sortBy} sortDir={sortInv.sortDir} onSort={sortInv.onSort} /></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortInv.sort(filteredInvoices).map(inv => (
                  <tr key={inv.id} className={`${styles.invoiceRow} ${inv.corrective_for ? styles.stornoRow : ''}`} onClick={() => setPrintInvoice(inv)} title={t('fiskOpenPrint')}>
                    <td>
                      <code className={styles.code}>{inv.invoice_number}</code>
                      {inv.corrective_for && <span className={styles.stornoBadge}>{t('fiskStornoBadge')}</span>}
                    </td>
                    <td>{new Date(inv.issued_at).toLocaleDateString(dl, { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                    <td>{t(SRC_KEY[inv.source_type] || 'fiskSrcOrder')}</td>
                    <td className={styles.right}>{invMoney(inv.total_vat_cents, inv.currency)}</td>
                    <td className={styles.right}>{invMoney(inv.total_cents, inv.currency)}</td>
                    <td><span className={styles.statBadge}>{t(STATUS_KEY[inv.fiscal_status] || 'fiskStatPending')}</span></td>
                    <td className={styles.right}>
                      {!inv.corrective_for && !stornoedIds.has(inv.id) && (
                        <button className={styles.stornoBtn} onClick={(e) => stornoInvoice(inv, e)}>↩︎ {t('fiskStorno')}</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>)}
      </div>
      <div className={styles.card}>
        <div className={styles.cardTitleRow}>
          <span className={styles.cardTitle}>{t('fiskProviderTitle')}</span>
          <span className={styles.soon}>{t('fiskSoon')}</span>
        </div>
        <div className={styles.cardHint}>{t('fiskProviderHint')}</div>
      </div>

      {printInvoice && (
        <InvoicePrintModal invoice={printInvoice} restaurant={restaurant} onClose={() => setPrintInvoice(null)} />
      )}
      {splitSource && (
        <SplitInvoiceModal restaurant={restaurant} source={splitSource}
          onClose={() => setSplitSource(null)} onDone={() => { loadUnbilled(); loadInvoices() }} />
      )}
    </div>
  )
}
