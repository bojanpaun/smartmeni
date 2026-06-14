import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import { formatMoney } from '../../../lib/currencies'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import styles from './Hotel.module.css'
import na from './NightAudit.module.css'

// Lokalni "danas" (Europe/Podgorica praktično = lokalna mašina recepcije)
const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const TYPE_LABEL_KEYS = { room_charge: 'htTypeRoom', restaurant: 'htTypeRestaurant', minibar: 'htTypeMinibar', spa: 'htTypeSpa', other: 'htTypeOther' }
const fmtDate = (s, dl) => s ? new Date(s).toLocaleDateString(dl, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export default function NightAuditPage() {
  const { restaurant } = usePlatform()
  const { t, i18n } = useTranslation('admin')
  const dl = i18n.language === 'en' ? 'en-US' : 'sr-Latn'
  const eur = (n) => formatMoney(n, restaurant?.currency, i18n.language)
  const typeLabel = (ty) => TYPE_LABEL_KEYS[ty] ? t(TYPE_LABEL_KEYS[ty]) : ty
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
    if (error) { toast.error(t('htErr') + ': ' + error.message); return }
    setResult(data)
    if (data?.already_run) {
      toast(t('htAuditAlreadyRun'), { icon: 'ℹ️' })
    } else {
      toast.success(t('htAuditDone', { n: data?.room_charges_posted ?? 0, amount: eur(data?.room_charges_amount) }))
    }
    loadHistory()
  }

  const exportCSV = (rep) => {
    if (!rep) return
    const rows = [
      [t('htCsvDailyReport'), fmtDate(rep.business_date, dl)],
      [],
      [t('htTotalRevenue'), Number(rep.revenue_total || 0).toFixed(2)],
      [t('htOccupancyPct'), rep.occupancy_pct ?? 0],
      [t('htRoomsOccupiedHead'), `${rep.rooms_occupied}/${rep.rooms_total}`],
      ['ADR', Number(rep.adr || 0).toFixed(2)],
      [t('htRoomChargeItems'), rep.room_charges_posted ?? 0],
      [t('htRoomChargeAmount'), Number(rep.room_charges_amount || 0).toFixed(2)],
      [],
      [t('htRevenueByCategory'), t('htAmountEur')],
      ...Object.entries(rep.revenue_by_type || {}).map(([ty, a]) => [typeLabel(ty), Number(a || 0).toFixed(2)]),
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
          <h1 className={styles.title}>{t('htNightAuditTitle')}</h1>
          <p className={styles.subtitle}>{t('htNightAuditSub')}</p>
        </div>
      </div>

      {/* Pokretanje */}
      <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div className={na.runRow}>
          <div className={na.runField}>
            <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>{t('htDayToClose')}</label>
            <input className={styles.input} type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value)} style={{ width: '100%' }} />
          </div>
          <button className={`${styles.btnPrimary} ${na.runBtn}`} onClick={runAudit} disabled={running}>
            {running ? t('htRunning') : `🌙 ${t('htRunAudit')}`}
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 10, marginBottom: 0 }}>
          {t('htAuditAutoNote')}
        </p>
      </div>

      {/* Rezultat zadnjeg audita */}
      {report && (
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600 }}>
              {t('htReport')} — {fmtDate(report.business_date, dl)}
              {result?.already_run && <span style={{ fontSize: 12, color: 'var(--c-text-muted)', fontWeight: 400 }}> {t('htAlreadyClosed')}</span>}
            </div>
            <button className={styles.btnSecondary} style={{ fontSize: 12 }} onClick={() => exportCSV(report)}>⬇️ CSV</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
            <Stat label={t('htTotalRevenue')} value={eur(report.revenue_total)} />
            <Stat label={t('kpiOccupancy')} value={`${report.occupancy_pct ?? 0}%`} sub={t('htRoomsOccupied', { occupied: report.rooms_occupied, total: report.rooms_total })} />
            <Stat label="ADR" value={eur(report.adr)} sub={t('htAdrSub')} />
            <Stat label={t('htRoomCharge')} value={`${report.room_charges_posted ?? 0}×`} sub={eur(report.room_charges_amount)} />
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--c-text-medium)' }}>{t('htRevenueByCategory')}</div>
          {Object.keys(revByType).length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>{t('htNoRevenueDay')}</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: openCheckout.length ? 16 : 0 }}>
              {Object.entries(revByType).map(([type, amt]) => (
                <div key={type} style={{ padding: '6px 12px', border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 13 }}>
                  {typeLabel(type)}: <strong>{eur(amt)}</strong>
                </div>
              ))}
            </div>
          )}

          {openCheckout.length > 0 && (
            <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--c-danger-border)', background: 'var(--c-danger-bg)', borderRadius: 8 }}>
              <div style={{ fontWeight: 600, color: 'var(--c-danger)', fontSize: 13, marginBottom: 6 }}>
                ⚠️ {t('htOpenFolios', { n: openCheckout.length })}
              </div>
              {openCheckout.map(f => (
                <div key={f.folio_id} style={{ fontSize: 13, color: 'var(--c-danger)' }}>
                  {t('htOwes', { name: f.guest_name, amount: eur((f.total_amount || 0) - (f.paid_amount || 0)) })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Istorija audita */}
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{t('htAuditHistory')}</div>
      {loadingHist ? <LoadingSpinner /> : history.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--c-text-muted)' }}>{t('htNoAudits')}</div>
      ) : (
        <div className={na.histWrap}>
          <table className={na.histTable}>
            <thead>
              <tr>
                <th>{t('htDateHead')}</th>
                <th>{t('htRevenueHead')}</th>
                <th>{t('kpiOccupancy')}</th>
                <th>{t('htRoomCharge')}</th>
                <th>{t('htRunAt')}</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id}
                    onClick={() => { setResult({ report: h.report, already_run: true }); setDate(h.business_date) }}>
                  <td className={na.dateCell} data-label={t('htDateHead')}>{fmtDate(h.business_date, dl)}</td>
                  <td data-label={t('htRevenueHead')}>{eur(h.report?.revenue_total)}</td>
                  <td data-label={t('kpiOccupancy')}>{h.report?.occupancy_pct ?? 0}%</td>
                  <td data-label={t('htRoomCharge')}>{h.room_charges_posted}× · {eur(h.room_charges_amount)}</td>
                  <td className={na.mutedCell} data-label={t('htRunAt')}>
                    {h.run_at ? new Date(h.run_at).toLocaleString(dl, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
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
