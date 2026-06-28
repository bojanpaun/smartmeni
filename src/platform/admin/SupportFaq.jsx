import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import styles from '../../modules/hotel/pages/Hotel.module.css'

export const FAQ_CATS = {
  rezervacije:  'Rezervacije',
  folio:        'Folio',
  meni:         'Meni i narudžbe',
  spa:          'Spa',
  housekeeping: 'Domaćinstvo',
  inventar:     'Inventar',
  placanja:     'Plaćanja',
  hardver:      'Hardver',
  osoblje:      'Osoblje / HR',
  ostalo:       'Ostalo',
}

// Prijedlozi FAQ-a dok admin kuca novi tiket (na osnovu unesenog teksta).
export function FaqSuggestions({ query }) {
  const { t } = useTranslation('admin')
  const [items, setItems] = useState([])
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    supabase.from('support_faq').select('id, question, answer')
      .eq('is_published', true)
      .then(({ data }) => setItems(data ?? []))
  }, [])

  const words = (query || '').toLowerCase().split(/\s+/).filter(w => w.length >= 3)
  if (words.length === 0) return null
  const matches = items.filter(i => {
    const text = (i.question + ' ' + i.answer).toLowerCase()
    return words.some(w => text.includes(w))
  }).slice(0, 3)
  if (matches.length === 0) return null

  return (
    <div style={{ background: 'var(--c-info-bg)', border: '1px solid var(--c-info-border)', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-info)', marginBottom: 6 }}>💡 {t('fqMaybeHelps')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {matches.map(f => {
          const open = openId === f.id
          return (
            <div key={f.id}>
              <button onClick={() => setOpenId(open ? null : f.id)} style={{ background: 'none', border: 'none', padding: '3px 0', cursor: 'pointer', color: 'var(--c-info)', fontSize: 13, fontWeight: 600, textAlign: 'left' }}>
                {open ? '▾' : '▸'} {f.question}
              </button>
              {open && <div style={{ fontSize: 13, color: 'var(--c-info)', whiteSpace: 'pre-wrap', lineHeight: 1.5, padding: '2px 0 6px 14px' }}>{f.answer}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// FAQ / baza znanja na vrhu /admin/support — admin prvo traži odgovor.
export default function SupportFaq() {
  const { t } = useTranslation('admin')
  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    supabase.from('support_faq').select('*')
      .eq('is_published', true)
      .order('category').order('sort_order')
      .then(({ data }) => { setItems(data ?? []); setLoaded(true) })
  }, [])

  const cats = ['all', ...Array.from(new Set(items.map(i => i.category)))]
  const filtered = items.filter(i => {
    if (cat !== 'all' && i.category !== cat) return false
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      if (!(i.question.toLowerCase().includes(s) || i.answer.toLowerCase().includes(s))) return false
    }
    return true
  })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>📖 {t('fqTitle')}</h1>
          <p className={styles.subtitle}>{t('fqSub')}</p>
        </div>
      </div>

      {loaded && items.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-text-muted)' }}>{t('fqNoQuestions')}</div>
      )}

      {items.length > 0 && (<>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <input className={styles.input} placeholder={`🔍 ${t('fqSearchQ')}`} value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {cats.map(c => (
            <button key={c} onClick={() => setCat(c)}
              className={cat === c ? styles.btnPrimary : styles.btnSecondary} style={{ fontSize: 12, padding: '6px 10px' }}>
              {c === 'all' ? t('invCatAll') : (FAQ_CATS[c] || c)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--c-text-muted)', padding: '6px 0' }}>{t('fqNoResults')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(f => {
            const open = openId === f.id
            return (
              <div key={f.id} style={{ border: '1px solid var(--c-border)', borderRadius: 10, overflow: 'hidden' }}>
                <button onClick={() => setOpenId(open ? null : f.id)} style={{
                  width: '100%', textAlign: 'left', background: open ? 'var(--c-bg)' : 'transparent', border: 'none',
                  padding: '11px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontWeight: 600, fontSize: 14, color: 'var(--c-text)',
                }}>
                  <span>{f.question}</span>
                  <span style={{ color: 'var(--c-text-muted)', flexShrink: 0 }}>{open ? '−' : '+'}</span>
                </button>
                {open && (
                  <div style={{ padding: '0 14px 12px', fontSize: 14, color: 'var(--c-text-medium)', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{f.answer}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
      </>)}
    </div>
  )
}
