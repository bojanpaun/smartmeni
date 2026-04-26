// src/modules/menu/pages/AdminMenuQR.jsx
import { useState } from 'react'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './GeneralSettings.module.css'

export default function AdminMenuQR() {
  const { restaurant } = usePlatform()
  const [copied, setCopied] = useState(false)

  if (!restaurant) return <div className={styles.loading}>Učitavanje...</div>

  const baseUrl = window.location.hostname === 'localhost'
    ? window.location.origin
    : 'https://smartmeni.me'
  const guestUrl = `${baseUrl}/${restaurant.slug}?qr=1`

  const copy = () => {
    navigator.clipboard.writeText(guestUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>QR kod</h1>
        <p className={styles.subtitle}>Podijelite link ili odštampajte QR kod za stolove.</p>
      </div>

      <div style={{
        background: '#fff', borderRadius: 16, border: '1px solid #e0ece6',
        padding: '28px 32px', maxWidth: 640,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0e1a14', marginBottom: 24 }}>
          Vaš QR kod i link
        </div>

        <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* QR placeholder */}
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{
              width: 140, height: 140, border: '2px solid #d0e4dc', borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#f8fbf9',
            }}>
              <svg width="90" height="90" viewBox="0 0 80 80" fill="none">
                <rect x="2" y="2" width="26" height="26" rx="3" stroke="#1a2e26" strokeWidth="3" fill="none"/>
                <rect x="10" y="10" width="10" height="10" rx="1" fill="#1a2e26"/>
                <rect x="52" y="2" width="26" height="26" rx="3" stroke="#1a2e26" strokeWidth="3" fill="none"/>
                <rect x="60" y="10" width="10" height="10" rx="1" fill="#1a2e26"/>
                <rect x="2" y="52" width="26" height="26" rx="3" stroke="#1a2e26" strokeWidth="3" fill="none"/>
                <rect x="10" y="60" width="10" height="10" rx="1" fill="#1a2e26"/>
                <rect x="36" y="4" width="8" height="8" rx="1" fill="#1a2e26"/>
                <rect x="36" y="36" width="8" height="8" rx="1" fill="#1a2e26"/>
                <rect x="48" y="36" width="8" height="8" rx="1" fill="#1a2e26"/>
                <rect x="60" y="36" width="8" height="8" rx="1" fill="#1a2e26"/>
                <rect x="36" y="48" width="8" height="8" rx="1" fill="#1a2e26"/>
                <rect x="60" y="48" width="8" height="8" rx="1" fill="#1a2e26"/>
                <rect x="48" y="60" width="8" height="8" rx="1" fill="#1a2e26"/>
                <rect x="36" y="68" width="8" height="8" rx="1" fill="#1a2e26"/>
                <rect x="60" y="68" width="8" height="8" rx="1" fill="#1a2e26"/>
              </svg>
            </div>
            <div style={{ fontSize: 12, color: '#8a9e96', marginTop: 8 }}>{restaurant.name}</div>
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#8a9e96', marginBottom: 6 }}>
              Link za goste
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#f0f8f4', borderRadius: 10, padding: '10px 14px', marginBottom: 14,
            }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#0d7a52', wordBreak: 'break-all' }}>
                {guestUrl}
              </span>
              <button
                onClick={copy}
                style={{
                  padding: '6px 14px', borderRadius: 8,
                  background: copied ? '#0d7a52' : '#fff', color: copied ? '#fff' : '#0d7a52',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                  border: '1px solid #0d7a52', fontFamily: 'DM Sans, sans-serif',
                  transition: 'all 0.2s',
                }}
              >
                {copied ? '✓ Kopirano' : 'Kopiraj'}
              </button>
            </div>

            <p style={{ fontSize: 13, color: '#5a7a6a', lineHeight: 1.6, marginBottom: 18 }}>
              Odštampajte QR kod i zalijepite na svaki sto. Gosti skeniraju i meni se odmah otvara na telefonu bez instalacije aplikacije.
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a
                href={`/${restaurant.slug}?qr=1`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '10px 20px', borderRadius: 10,
                  background: restaurant.color || '#0d7a52', color: '#fff',
                  fontSize: 13, fontWeight: 600, textDecoration: 'none',
                }}
              >
                Otvori meni →
              </a>
              <button
                onClick={() => window.print()}
                style={{
                  padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
                  border: '1px solid #d0e4dc', background: '#fff',
                  fontSize: 13, fontWeight: 600, color: '#3a6a56',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                🖨️ Štampaj
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
