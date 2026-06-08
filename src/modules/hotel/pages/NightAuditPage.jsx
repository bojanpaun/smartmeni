import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import styles from './Hotel.module.css'

// Lokalni "danas" (Europe/Podgorica praktično = lokalna mašina recepcije)
const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const TYPE_LABEL = { room_charge: 'Sobe', restaurant: 'Restoran', minibar: 'Minibar', spa: 'Spa', other: 'Ostalo' }
const eur = (n) => `€${Number(n || 0).toFixed(2)}`
const fmtDate = (s) => s ? new Date(s).toLocaleDateString('sr-Latn', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export default function NightAuditPage() {
  const { restaurant } = usePlatform()
  const [date, setDate] = useState(todayISO())
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)   // odgovor zadnjeg run-a (report)
  const [history, setHistory] = useState([])
  const [loadingHist, setLoadingHist] = useState(true)

  const loadHistory = async () => {
    if (!restaurant?.id) return
    setLoadingHist(true)
    const { data } = await supabase
      .from('night_audit_runs')
      .select('id, business_date, room_charges_posted, room_charges_amount, report, run_at')
      .eq('restaurant_id', restaurant.id)
      .order('business_date', { ascending: false })
      .limit(30)
    setHistory(data ?? [])
    setLoadingHist(false)
  }
  useEffect(() => { loadHistory() }, [restaurant?.id])

  const runAudit = async () => {
    if (!restaurant?.id) return
    setRunning(true)
    const { data, error } = await supabase.rpc('run_night_audit', {
      p_restaurant_id: restaurant.id,
      p_business_date: date,
    })
    setRunning(false)
    if (error) { toast.error('Greška: ' + error.message); return }
    setResult(data)
    if (data?.already_run) {
      toast('Audit za taj dan je već urađen — prikazan postojeći izvještaj', { icon: 'ℹ️' })
    } else {
      toast.success(`Audit završen — ${data?.room_charges_posted ?? 0} room charge stavki (${eur(data?.room_charges_amount)})`)
    }
    loadHistory()
  }

  const exportCSV = (rep) => {
    if (!rep) return
    const rows = [
      ['Dnevni izvještaj', fmtDate(rep.business_date)],
      [],
      ['Ukupan prihod', Number(rep.revenue_total || 0).toFixed(2)],
      ['Popunjenost (%)', rep.occupancy_pct ?? 0],
      ['Zauzete sobe', `${rep.rooms_occupied}/${rep.rooms_total}`],
      ['ADR', Number(rep.adr || 0).toFixed(2)],
      ['Room charge stavki', rep.room_charges_posted ?? 0],
      ['Room charge iznos', Number(rep.room_charges_amount || 0).toFixed(2)],
      [],
      ['Prihod po kategoriji', 'Iznos (€)'],
      ...Object.entries(rep.revenue_by_type || {}).map(([t, a]) => [TYPE_LABEL[t] || t, Number(a || 0).toFixed(2)]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nocni-audit-${rep.business_date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!restaurant) return <LoadingSpinner fullPage />

  const report = result?.report
  const revByType = report?.revenue_by_type || {}
  const openCheckout = report?.open_folios_checked_out || []

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Noćni audit</h1>
          <p className={styles.subtitle}>Zatvaranje dana (EOD) — room charge na folije, housekeeping reset, dnevni izvještaj</p>
        </div>
      </div>

      {/* Pokretanje */}
      <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>Dan koji se zatvara</label>
            <input className={styles.input} type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value)} />
          </div>
          <button className={styles.btnPrimary} onClick={runAudit} disabled={running}>
            {running ? 'Pokrećem…' : '🌙 Pokreni noćni audit'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 10, marginBottom: 0 }}>
          Automatski se pokreće svake noći. Ručno pokretanje je idempotentno — ponovni audit istog dana ne dodaje duple stavke.
        </p>
      </div>

      {/* Rezultat zadnjeg audita */}
      {report && (
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600 }}>
              Izvještaj — {fmtDate(report.business_date)}
              {result?.already_run && <span style={{ fontSize: 12, color: 'var(--c-text-muted)', fontWeight: 400 }}> (već zatvoreno)</span>}
            </div>
            <button className={styles.btnSecondary} style={{ fontSize: 12 }} onClick={() => exportCSV(report)}>⬇️ CSV</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
            <Stat label="Ukupan prihod" value={eur(report.revenue_total)} />
            <Stat label="Popunjenost" value={`${report.occupancy_pct ?? 0}%`} sub={`${report.rooms_occupied}/${report.rooms_total} soba`} />
            <Stat label="ADR" value={eur(report.adr)} sub="prosj. cijena sobe" />
            <Stat label="Room charge" value={`${report.room_charges_posted ?? 0}×`} sub={eur(report.room_charges_amount)} />
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--c-text-medium)' }}>Prihod po kategoriji</div>
          {Object.keys(revByType).length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>Nema prihoda za ovaj dan.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: openCheckout.length ? 16 : 0 }}>
              {Object.entries(revByType).map(([type, amt]) => (
                <div key={type} style={{ padding: '6px 12px', border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 13 }}>
                  {TYPE_LABEL[type] || type}: <strong>{eur(amt)}</strong>
                </div>
              ))}
            </div>
          )}

          {openCheckout.length > 0 && (
            <div style={{ marginTop: 12, padding: 12, border: '1px solid #fca5a5', background: '#fef2f2', borderRadius: 8 }}>
              <div style={{ fontWeight: 600, color: '#c0392b', fontSize: 13, marginBottom: 6 }}>
                ⚠️ Otvoreni folji za odjavljene goste ({openCheckout.length})
              </div>
              {openCheckout.map(f => (
                <div key={f.folio_id} style={{ fontSize: 13, color: '#7f1d1d' }}>
                  {f.guest_name} — duguje {eur((f.total_amount || 0) - (f.paid_amount || 0))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Istorija audita */}
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Istorija audita</div>
      {loadingHist ? <LoadingSpinner /> : history.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--c-text-muted)' }}>Još nema pokrenutih audita.</div>
      ) : (
        <div className={styles.table}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--c-surface)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--c-border)' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>Datum</th>
                <th style={{ padding: '10px 12px' }}>Prihod</th>
                <th style={{ padding: '10px 12px' }}>Popunjenost</th>
                <th style={{ padding: '10px 12px' }}>Room charge</th>
                <th style={{ padding: '10px 12px' }}>Pokrenut</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id} style={{ borderTop: '1px solid var(--c-border)', cursor: 'pointer' }}
                    onClick={() => { setResult({ report: h.report, already_run: true }); setDate(h.business_date) }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{fmtDate(h.business_date)}</td>
                  <td style={{ padding: '10px 12px' }}>{eur(h.report?.revenue_total)}</td>
                  <td style={{ padding: '10px 12px' }}>{h.report?.occupancy_pct ?? 0}%</td>
                  <td style={{ padding: '10px 12px' }}>{h.room_charges_posted}× · {eur(h.room_charges_amount)}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--c-text-muted)' }}>
                    {h.run_at ? new Date(h.run_at).toLocaleString('sr-Latn', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, sub }) {
  return (
    <div style={{ padding: 12, border: '1px solid var(--c-border)', borderRadius: 10, background: 'var(--c-bg, transparent)' }}>
      <div style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
