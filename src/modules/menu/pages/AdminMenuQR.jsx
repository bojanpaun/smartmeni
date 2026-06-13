// src/modules/menu/pages/AdminMenuQR.jsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './GeneralSettings.module.css'

export default function AdminMenuQR() {
  const { t } = useTranslation('admin')
  const { restaurant } = usePlatform()
  const [copied, setCopied] = useState(false)

  if (!restaurant) return <div className={styles.loading}>{t('loading')}</div>

  // Uvijek koristi trenutni origin — radi i na localhost i na produkciji
  const guestUrl = `${window.location.origin}/${restaurant.slug}?qr=1`

  const copy = () => {
    navigator.clipboard.writeText(guestUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('navQr')}</h1>
        <p className={styles.subtitle}>{t('amQrPageSubtitle')}</p>
      </div>

      <div style={{
        background: 'var(--c-surface)', borderRadius: 16, border: '1px solid var(--c-border)',
        padding: '28px 32px', maxWidth: 640,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', marginBottom: 24 }}>
          {t('amQrTitle')}
        </div>

        <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* QR placeholder */}
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{
              width: 140, height: 140, border: '2px solid var(--c-border-input)', borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--c-bg-subtle)',
            }}>
              <svg width="90" height="90" viewBox="0 0 80 80" fill="none">
                <rect x="2" y="2" width="26" height="26" rx="3" stroke="var(--c-text)" strokeWidth="3" fill="none"/>
                <rect x="10" y="10" width="10" height="10" rx="1" fill="var(--c-text)"/>
                <rect x="52" y="2" width="26" height="26" rx="3" stroke="var(--c-text)" strokeWidth="3" fill="none"/>
                <rect x="60" y="10" width="10" height="10" rx="1" fill="var(--c-text)"/>
                <rect x="2" y="52" width="26" height="26" rx="3" stroke="var(--c-text)" strokeWidth="3" fill="none"/>
                <rect x="10" y="60" width="10" height="10" rx="1" fill="var(--c-text)"/>
                <rect x="36" y="4" width="8" height="8" rx="1" fill="var(--c-text)"/>
                <rect x="36" y="36" width="8" height="8" rx="1" fill="var(--c-text)"/>
                <rect x="48" y="36" width="8" height="8" rx="1" fill="var(--c-text)"/>
                <rect x="60" y="36" width="8" height="8" rx="1" fill="var(--c-text)"/>
                <rect x="36" y="48" width="8" height="8" rx="1" fill="var(--c-text)"/>
                <rect x="60" y="48" width="8" height="8" rx="1" fill="var(--c-text)"/>
                <rect x="48" y="60" width="8" height="8" rx="1" fill="var(--c-text)"/>
                <rect x="36" y="68" width="8" height="8" rx="1" fill="var(--c-text)"/>
                <rect x="60" y="68" width="8" height="8" rx="1" fill="var(--c-text)"/>
              </svg>
            </div>
            <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 8 }}>{restaurant.name}</div>
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--c-text-muted)', marginBottom: 6 }}>
              {t('amLinkForGuests')}
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--c-primary-light)', borderRadius: 10, padding: '10px 14px', marginBottom: 14,
            }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--c-primary)', wordBreak: 'break-all' }}>
                {guestUrl}
              </span>
              <button
                onClick={copy}
                style={{
                  padding: '6px 14px', borderRadius: 8,
                  background: copied ? 'var(--c-primary)' : 'var(--c-surface)', color: copied ? '#fff' : 'var(--c-primary)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                  border: '1px solid var(--c-primary)', fontFamily: 'DM Sans, sans-serif',
                  transition: 'all 0.2s',
                }}
              >
                {copied ? `✓ ${t('amCopied')}` : t('amCopy')}
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--c-text-medium)', lineHeight: 1.6, marginBottom: 18 }}>
              {t('amQrNoteLong')}
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a
                href={`/${restaurant.slug}?qr=1`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '10px 20px', borderRadius: 10,
                  background: restaurant.color || 'var(--c-primary)', color: '#fff',
                  fontSize: 13, fontWeight: 600, textDecoration: 'none',
                }}
              >
                {t('amOpenMenu')}
              </a>
              <button
                onClick={() => window.print()}
                style={{
                  padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
                  border: '1px solid var(--c-border-input)', background: 'var(--c-surface)',
                  fontSize: 13, fontWeight: 600, color: 'var(--c-text-medium)',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                🖨️ {t('amPrint')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
