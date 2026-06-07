import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'
import styles from './BillingControl.module.css'

const CATEGORY_LABELS = {
  restaurant: '🍽️ Restoran',
  hotel:      '🏨 Hotel',
  enterprise: '🏢 Enterprise',
}

function numOrNull(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

export default function BillingControl() {
  const { isSuperAdmin, user } = usePlatform()
  const navigate = useNavigate()

  const [settings, setSettings] = useState({ beta_free_mode: false, beta_note: '' })
  const [addons, setAddons] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [savingId, setSavingId] = useState(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [{ data: s }, { data: a }, { data: p }] = await Promise.all([
      supabase.from('platform_settings').select('beta_free_mode, beta_note').limit(1).maybeSingle(),
      // Superadmin vidi i neaktivne (FOR ALL politika) — ne filtriramo is_active.
      supabase.from('addon_catalog')
        .select('id, name, category, price_monthly, price_yearly, is_active, beta_free, sort_order')
        .order('sort_order'),
      supabase.from('plans')
        .select('id, name, price_monthly, price_annual_per_month, price_annual_total, includes, is_active, sort_order')
        .order('sort_order'),
    ])
    setSettings(s ?? { beta_free_mode: false, beta_note: '' })
    setAddons(a ?? [])
    setPlans(p ?? [])
    setLoading(false)
  }

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2800) }

  const saveBeta = async (patch) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    const { data, error } = await supabase.from('platform_settings')
      .update({
        beta_free_mode: next.beta_free_mode,
        beta_note: next.beta_note || null,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      })
      .eq('id', true)
      .select('id')
    if (!error && (!data || data.length === 0)) return flash('Greška: nije sačuvano (nedovoljna prava).')
    flash(error ? 'Greška: ' + error.message : 'Sačuvano.')
  }

  const patchAddon = (id, patch) => setAddons(list => list.map(a => a.id === id ? { ...a, ...patch } : a))
  const saveAddon = async (a) => {
    setSavingId(a.id)
    const { data, error } = await supabase.from('addon_catalog')
      .update({
        price_monthly: numOrNull(a.price_monthly),
        price_yearly: numOrNull(a.price_yearly),
        is_active: a.is_active,
        beta_free: a.beta_free,
      })
      .eq('id', a.id)
      .select('id')
    setSavingId(null)
    if (!error && (!data || data.length === 0)) return flash('Greška: nije sačuvano (prava).')
    flash(error ? 'Greška: ' + error.message : `Sačuvano: ${a.name}`)
  }

  const patchPlan = (id, patch) => setPlans(list => list.map(p => p.id === id ? { ...p, ...patch } : p))
  const savePlan = async (p) => {
    setSavingId(p.id)
    const { data, error } = await supabase.from('plans')
      .update({
        price_monthly: numOrNull(p.price_monthly),
        price_annual_per_month: numOrNull(p.price_annual_per_month),
        price_annual_total: numOrNull(p.price_annual_total),
        is_active: p.is_active,
      })
      .eq('id', p.id)
      .select('id')
    setSavingId(null)
    if (!error && (!data || data.length === 0)) return flash('Greška: nije sačuvano (prava).')
    flash(error ? 'Greška: ' + error.message : `Sačuvano: ${p.name}`)
  }

  if (!isSuperAdmin()) {
    return (
      <div className={styles.accessDenied}>
        <div>🔒</div>
        <div>Nemate pristup ovoj stranici.</div>
      </div>
    )
  }
  if (loading) return <div className={styles.loading}>Učitavanje cijena…</div>

  const addonsByCat = addons.reduce((acc, a) => {
    const c = a.category || 'restaurant'
    ;(acc[c] ??= []).push(a)
    return acc
  }, {})

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <div className={styles.headerTitle}>Naplata i cijene</div>
          <div className={styles.headerSub}>Cijene planova i addona · beta-free prekidači</div>
        </div>
        <button className={styles.btnGhost} onClick={() => navigate('/superadmin')}>← Super admin</button>
      </div>

      {msg && (
        <div className={msg.startsWith('Greška') ? styles.toastErr : styles.toastOk}>{msg}</div>
      )}

      {/* ─── GLOBALNI BETA PREKIDAČ ─────────────────────────────── */}
      <section className={`${styles.card} ${settings.beta_free_mode ? styles.cardBetaOn : ''}`}>
        <div className={styles.betaHead}>
          <div>
            <div className={styles.cardTitle}>🧪 Beta — sve besplatno</div>
            <div className={styles.cardSub}>
              Dok je uključeno, <strong>svi tenanti</strong> koriste sve module besplatno
              (ograničeno samo izabranim vertikalama). Paywall se ne prikazuje.
            </div>
          </div>
          <Toggle on={settings.beta_free_mode} onClick={() => saveBeta({ beta_free_mode: !settings.beta_free_mode })} big />
        </div>
        {settings.beta_free_mode && (
          <div className={styles.betaLiveWarn}>⚠️ Beta je AKTIVNA — naplata je trenutno isključena za sve.</div>
        )}
        <div className={styles.field}>
          <label>Napomena (interna)</label>
          <div className={styles.noteRow}>
            <input
              placeholder="npr. Beta period do kraja jula 2026"
              value={settings.beta_note || ''}
              onChange={e => setSettings(s => ({ ...s, beta_note: e.target.value }))}
            />
            <button className={styles.btnSave} onClick={() => saveBeta({})}>Sačuvaj</button>
          </div>
        </div>
      </section>

      {/* ─── PLANOVI ────────────────────────────────────────────── */}
      <section className={styles.card}>
        <div className={styles.cardTitle}>📦 Planovi</div>
        <div className={styles.cardSub}>Mjesečna i godišnja cijena bundle planova. Enterprise = po dogovoru (prazno).</div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Plan</th>
                <th>€/mj</th>
                <th>€/mj (godišnje)</th>
                <th>€ godišnje ukupno</th>
                <th>Aktivan</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {plans.map(p => (
                <tr key={p.id}>
                  <td className={styles.nameCell}>{p.name}<span className={styles.idTag}>{p.id}</span></td>
                  <td data-label="€/mj"><PriceInput value={p.price_monthly} onChange={v => patchPlan(p.id, { price_monthly: v })} /></td>
                  <td data-label="€/mj (godišnje)"><PriceInput value={p.price_annual_per_month} onChange={v => patchPlan(p.id, { price_annual_per_month: v })} /></td>
                  <td data-label="€ godišnje ukupno"><PriceInput value={p.price_annual_total} onChange={v => patchPlan(p.id, { price_annual_total: v })} /></td>
                  <td data-label="Aktivan"><Toggle on={p.is_active} onClick={() => patchPlan(p.id, { is_active: !p.is_active })} /></td>
                  <td className={styles.saveCell}>
                    <button className={styles.btnSave} disabled={savingId === p.id} onClick={() => savePlan(p)}>
                      {savingId === p.id ? '…' : 'Sačuvaj'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── ADDONI ─────────────────────────────────────────────── */}
      <section className={styles.card}>
        <div className={styles.cardTitle}>🧩 Addoni</div>
        <div className={styles.cardSub}>
          <strong>Aktivan</strong> = nudi se i naplaćuje. <strong>Beta-free</strong> = besplatan
          tokom bete (nezavisno od globalnog prekidača).
        </div>
        {Object.entries(addonsByCat).map(([cat, list]) => (
          <div key={cat} className={styles.catGroup}>
            <div className={styles.catLabel}>{CATEGORY_LABELS[cat] ?? cat}</div>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Addon</th>
                    <th>€/mj</th>
                    <th>€/god</th>
                    <th>Aktivan</th>
                    <th>Beta-free</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(a => (
                    <tr key={a.id} className={a.beta_free ? styles.rowBeta : ''}>
                      <td className={styles.nameCell}>{a.name}<span className={styles.idTag}>{a.id}</span></td>
                      <td data-label="€/mj"><PriceInput value={a.price_monthly} onChange={v => patchAddon(a.id, { price_monthly: v })} /></td>
                      <td data-label="€/god"><PriceInput value={a.price_yearly} onChange={v => patchAddon(a.id, { price_yearly: v })} /></td>
                      <td data-label="Aktivan"><Toggle on={a.is_active} onClick={() => patchAddon(a.id, { is_active: !a.is_active })} /></td>
                      <td data-label="Beta-free"><Toggle on={a.beta_free} onClick={() => patchAddon(a.id, { beta_free: !a.beta_free })} /></td>
                      <td className={styles.saveCell}>
                        <button className={styles.btnSave} disabled={savingId === a.id} onClick={() => saveAddon(a)}>
                          {savingId === a.id ? '…' : 'Sačuvaj'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}

function PriceInput({ value, onChange }) {
  return (
    <input
      className={styles.priceInput}
      type="number"
      min="0"
      step="1"
      inputMode="decimal"
      placeholder="—"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
    />
  )
}

function Toggle({ on, onClick, big }) {
  return (
    <div
      role="switch"
      aria-checked={on}
      className={`${styles.toggle} ${on ? styles.toggleOn : styles.toggleOff} ${big ? styles.toggleBig : ''}`}
      onClick={onClick}
    />
  )
}
