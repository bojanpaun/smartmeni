// src/modules/hr/pages/StaffPortalInfo.jsx
import { useState } from 'react'
import { usePlatform } from '../../../context/PlatformContext'
import gsStyles from '../../menu/pages/GeneralSettings.module.css'

export default function StaffPortalInfo() {
  const { restaurant } = usePlatform()
  const [copied, setCopied] = useState(false)

  if (!restaurant) return null

  const portalUrl = `${window.location.origin}/${restaurant.slug}/osoblje`

  const copy = () => {
    navigator.clipboard.writeText(portalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={gsStyles.page} style={{ maxWidth: 640 }}>
      <div className={gsStyles.header}>
        <h1 className={gsStyles.title}>Portal zaposlenika</h1>
        <p className={gsStyles.subtitle}>Vaši zaposlenici mogu pristupiti svom rasporedu, dolascima i zaradama.</p>
      </div>

      {/* Link */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e0ece6', padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0e1a14', marginBottom: 10 }}>Link portala</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f0f8f4', borderRadius: 10, padding: '10px 14px' }}>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#0d7a52', wordBreak: 'break-all' }}>{portalUrl}</span>
          <button onClick={copy} style={{
            padding: '6px 14px', borderRadius: 8, border: '1px solid #0d7a52',
            background: copied ? '#0d7a52' : '#fff', color: copied ? '#fff' : '#0d7a52',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s',
          }}>
            {copied ? '✓ Kopirano' : 'Kopiraj'}
          </button>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
          <a href={portalUrl} target="_blank" rel="noreferrer" style={{
            padding: '9px 18px', borderRadius: 10, background: restaurant.color || '#0d7a52',
            color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none',
          }}>
            Otvori portal →
          </a>
        </div>
      </div>

      {/* Uputstvo */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e0ece6', padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0e1a14', marginBottom: 14 }}>Kako zaposlenici pristupaju portalu</div>
        {[
          { num: '1', title: 'Kreiraj nalog zaposleniku', desc: 'U modulu Zaposleni → dodaj zaposlenika sa emailom i lozinkom.' },
          { num: '2', title: 'Pošalji link', desc: `Zaposlenik otvara ${portalUrl} na svom telefonu ili računaru.` },
          { num: '3', title: 'Login', desc: 'Zaposlenik se loguje sa emailom i lozinkom koje si mu dodijelio.' },
          { num: '4', title: 'Pregled podataka', desc: 'Zaposlenik vidi svoj raspored, dolaske, zaradu i odsustva — bez mogućnosti izmjene.' },
        ].map(s => (
          <div key={s.num} style={{ display: 'flex', gap: 14, marginBottom: 14, alignItems: 'flex-start' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: '#e1f5ee',
              color: '#0d7a52', fontWeight: 700, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>{s.num}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2e26', marginBottom: 2 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: '#5a7a6a', lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Šta zaposlenik vidi */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e0ece6', padding: '20px 24px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0e1a14', marginBottom: 14 }}>Šta zaposlenik može vidjeti</div>
        {[
          { icon: '📅', label: 'Raspored', desc: 'Smjene za tekući mjesec, sedmična smjena istaknuta' },
          { icon: '🕐', label: 'Dolasci', desc: 'Clock in/out vremena i ukupni sati rada' },
          { icon: '💰', label: 'Zarada', desc: 'Osnovna plata, dodaci i odbitci po mjesecu' },
          { icon: '🏖️', label: 'Odsustva', desc: 'Godišnji odmor — iskorišteno i preostalo' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1a2e26' }}>{item.label}</span>
              <span style={{ fontSize: 12, color: '#8a9e96', marginLeft: 8 }}>{item.desc}</span>
            </div>
          </div>
        ))}
        <div style={{ marginTop: 12, padding: '10px 14px', background: '#f8fbf9', borderRadius: 10, fontSize: 12, color: '#5a7a6a', border: '1px solid #e0ece6' }}>
          ℹ️ Zaposlenik ne može mijenjati nikakve podatke — sve je read-only.
        </div>
      </div>
    </div>
  )
}
