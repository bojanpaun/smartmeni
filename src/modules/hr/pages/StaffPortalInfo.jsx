// src/modules/hr/pages/StaffPortalInfo.jsx
import { useState, useRef } from 'react'
import QRCode from 'react-qr-code'
import { usePlatform } from '../../../context/PlatformContext'
import gsStyles from '../../menu/pages/GeneralSettings.module.css'

// Sve boje idu kroz --c-* tokene (radi i u dark modu). Jedina iznimka je brend boja
// restorana (restaurant.color) na portal-materijalima — QR, štampa, brendirani CTA —
// jer ona prati javni identitet objekta i mora biti konkretan hex (QR/print export).
const card = {
  background: 'var(--c-surface)',
  borderRadius: 16,
  border: '1px solid var(--c-border)',
  padding: '20px 24px',
  marginBottom: 16,
}
const cardTitle = { fontSize: 13, fontWeight: 600, color: 'var(--c-text)', marginBottom: 10 }

export default function StaffPortalInfo() {
  const { restaurant } = usePlatform()
  const [copied, setCopied] = useState(false)
  const qrRef = useRef(null)

  if (!restaurant) return null

  const portalUrl = `${window.location.origin}/${restaurant.slug}/staff`
  const brand = restaurant.color || '#0d7a52'

  const copy = () => {
    navigator.clipboard.writeText(portalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const printQR = () => {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) return
    const svgStr = new XMLSerializer().serializeToString(svg)
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><title>QR — Portal zaposlenika</title>
      <style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;gap:16px}
      p{font-size:14px;color:#555;text-align:center}svg{width:200px;height:200px}@media print{button{display:none}}</style>
      </head><body>${svgStr}<p>${portalUrl}</p><p style="font-size:12px;color:#999">Portal zaposlenika — ${restaurant.name}</p>
      <button onclick="window.print()" style="margin-top:12px;padding:8px 20px;background:${brand};color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px">Štampaj</button>
      </body></html>`)
    win.document.close()
  }

  return (
    <div className={gsStyles.page} style={{ maxWidth: 640 }}>
      <div className={gsStyles.header}>
        <h1 className={gsStyles.title}>Portal zaposlenika</h1>
        <p className={gsStyles.subtitle}>Jedan portal za sve zaposlenike — sadržaj se prilagođava ulozi (konobar, sobarica, recepcija, spa terapeut…)</p>
      </div>

      {/* Link + QR */}
      <div style={card}>
        <div style={cardTitle}>Link portala</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--c-primary-light)', borderRadius: 10, padding: '10px 14px' }}>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--c-primary)', wordBreak: 'break-all' }}>{portalUrl}</span>
          <button onClick={copy} style={{
            padding: '6px 14px', borderRadius: 8, border: '1px solid var(--c-primary)',
            background: copied ? 'var(--c-primary)' : 'var(--c-surface)', color: copied ? '#fff' : 'var(--c-primary)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            fontFamily: 'var(--c-font-sans)', transition: 'all 0.2s',
          }}>
            {copied ? '✓ Kopirano' : 'Kopiraj'}
          </button>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
          <a href={portalUrl} target="_blank" rel="noreferrer" style={{
            padding: '9px 18px', borderRadius: 10, background: brand,
            color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none',
          }}>
            Otvori portal →
          </a>
        </div>
      </div>

      {/* QR kod */}
      <div style={card}>
        <div style={{ ...cardTitle, marginBottom: 4 }}>QR kod za zaposlenike</div>
        <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 16 }}>Štampajte i zalijepite na vidljivo mjesto — konobarnica, kuhinja, recepcija.</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
          {/* QR mora ostati na bijeloj podlozi radi skeniranja (i u dark modu) */}
          <div ref={qrRef} style={{ padding: 12, background: '#fff', border: '1px solid var(--c-border)', borderRadius: 12, display: 'inline-block' }}>
            <QRCode
              value={portalUrl}
              size={160}
              fgColor={brand}
              bgColor="#ffffff"
              level="M"
            />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 12, color: 'var(--c-text-medium)', lineHeight: 1.6, marginBottom: 14 }}>
              Zaposlenik skenira QR kodom → otvara se login stranica portala → loguje se sa email/lozinkom.
            </div>
            <button onClick={printQR} style={{
              padding: '9px 18px', borderRadius: 10, border: `1px solid ${brand}`,
              background: 'var(--c-surface)', color: brand,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--c-font-sans)',
            }}>
              🖨 Štampaj QR kod
            </button>
          </div>
        </div>
      </div>

      {/* Uputstvo */}
      <div style={card}>
        <div style={{ ...cardTitle, marginBottom: 14 }}>Kako zaposlenici pristupaju portalu</div>
        {[
          { num: '1', title: 'Kreiraj nalog zaposleniku', desc: 'U modulu Zaposleni → dodaj zaposlenika sa emailom i lozinkom.' },
          { num: '2', title: 'Pošalji link', desc: `Zaposlenik otvara ${portalUrl} na svom telefonu ili računaru.` },
          { num: '3', title: 'Login', desc: 'Zaposlenik se loguje sa emailom i lozinkom koje si mu dodijelio.' },
          { num: '4', title: 'Pregled podataka', desc: 'Zaposlenik vidi svoj raspored, dolaske, zaradu i odsustva — bez mogućnosti izmjene.' },
        ].map(s => (
          <div key={s.num} style={{ display: 'flex', gap: 14, marginBottom: 14, alignItems: 'flex-start' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: 'var(--c-primary-light)',
              color: 'var(--c-primary)', fontWeight: 700, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>{s.num}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)', marginBottom: 2 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: 'var(--c-text-medium)', lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Šta zaposlenik vidi */}
      <div style={{ ...card, marginBottom: 0 }}>
        <div style={{ ...cardTitle, marginBottom: 14 }}>Šta zaposlenik može vidjeti</div>
        {[
          { icon: '🧹', label: 'Sobarica', desc: 'Zadaci čišćenja za danas, prijava kvarova' },
          { icon: '🍽️', label: 'Konobar', desc: 'Aktivne narudžbe, waiter zahtjevi' },
          { icon: '🍳', label: 'Kuhinja', desc: 'Real-time kitchen display narudžbi' },
          { icon: '🛎️', label: 'Recepcija', desc: 'Check-in/out za danas, status soba' },
          { icon: '💆', label: 'Spa terapeut', desc: 'Dnevni termini i raspored' },
          { icon: '📅', label: 'Svi', desc: 'Raspored, dolasci, zarada, odsustva (HR tab)' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>{item.label}</span>
              <span style={{ fontSize: 12, color: 'var(--c-text-muted)', marginLeft: 8 }}>{item.desc}</span>
            </div>
          </div>
        ))}
        <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--c-bg-subtle)', borderRadius: 10, fontSize: 12, color: 'var(--c-text-medium)', border: '1px solid var(--c-border)' }}>
          ℹ️ Zaposlenik ne može mijenjati nikakve podatke — sve je read-only.
        </div>
      </div>
    </div>
  )
}
