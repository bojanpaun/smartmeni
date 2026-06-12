import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { LANGUAGES } from '../../i18n/languages'

// Generički editor prevoda jednog entiteta (menu_item, spa_service, ...): admin
// vidi AI prevode polja name/description po 6 jezika i može ručno ispraviti.
// Ručna verzija → is_override=true (piše direktno u content_translations preko
// owner RLS) → AI je više NE pregazi. Prazno polje + Sačuvaj = briše override →
// AI ponovo preuzme. Izvor ('me') se uređuje u formi entiteta, ne ovdje.
const TARGET_LANGS = LANGUAGES.filter(l => l.code !== 'me') // en/sr/hr/sq/tr/ru
const FIELDS = ['name', 'description']

export default function ContentTranslations({ restaurantId, entityType, entityId, headerTitle, sourceName = '', sourceDescription = '', onClose }) {
  const { t } = useTranslation('admin')
  const [vals, setVals] = useState({})
  const [initial, setInitial] = useState({})
  const [overridden, setOverridden] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase.from('content_translations')
      .select('field, lang, value, is_override')
      .eq('restaurant_id', restaurantId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .then(({ data }) => {
        if (cancelled) return
        const v = {}, ov = {}
        for (const r of data ?? []) {
          v[`${r.field}|${r.lang}`] = r.value
          ov[`${r.field}|${r.lang}`] = r.is_override
        }
        setVals(v); setInitial(v); setOverridden(ov); setLoading(false)
      })
    return () => { cancelled = true }
  }, [entityType, entityId, restaurantId])

  const setVal = (key, value) => { setVals(p => ({ ...p, [key]: value })); setSaved(false) }

  const save = async () => {
    setSaving(true)
    const upserts = [], deletes = []
    for (const field of FIELDS) {
      for (const l of TARGET_LANGS) {
        const key = `${field}|${l.code}`
        const cur = (vals[key] ?? '').trim()
        const init = (initial[key] ?? '').trim()
        if (cur === init) continue
        if (cur) upserts.push({ restaurant_id: restaurantId, entity_type: entityType, entity_id: entityId, field, lang: l.code, value: cur, is_override: true })
        else deletes.push({ field, lang: l.code })
      }
    }
    if (upserts.length) {
      await supabase.from('content_translations').upsert(upserts, { onConflict: 'restaurant_id,entity_type,entity_id,field,lang' })
    }
    for (const d of deletes) {
      await supabase.from('content_translations').delete()
        .eq('restaurant_id', restaurantId).eq('entity_type', entityType).eq('entity_id', entityId)
        .eq('field', d.field).eq('lang', d.lang)
    }
    setInitial({ ...vals })
    setOverridden(prev => {
      const next = { ...prev }
      for (const u of upserts) next[`${u.field}|${u.lang}`] = true
      for (const d of deletes) delete next[`${d.field}|${d.lang}`]
      return next
    })
    setSaving(false); setSaved(true)
  }

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', zIndex: 1000, overflowY: 'auto' }
  const modal = { background: 'var(--c-surface)', borderRadius: 14, width: '100%', maxWidth: 560, padding: 20, boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }
  const inp = { width: '100%', padding: '8px 10px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-bg)', color: 'var(--c-text)', fontSize: 14 }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>🌐 {t('amTransTitle')}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--c-text-muted)' }}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--c-text-muted)', marginBottom: 4 }}><strong>{headerTitle}</strong></div>
        <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 14 }}>{t('amTransSub')}</div>

        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--c-text-muted)' }}>…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {TARGET_LANGS.map(l => {
              const isOv = overridden[`name|${l.code}`] || overridden[`description|${l.code}`]
              return (
                <div key={l.code} style={{ border: '1px solid var(--c-border)', borderRadius: 10, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{l.native}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 10, background: isOv ? 'var(--c-warning-bg)' : 'var(--c-info-bg)', color: isOv ? 'var(--c-warning)' : 'var(--c-info)' }}>
                      {isOv ? t('amTransManual') : t('amTransAi')}
                    </span>
                  </div>
                  <label style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{t('amTransName')}</label>
                  <input style={{ ...inp, marginBottom: 8 }} value={vals[`name|${l.code}`] ?? ''} placeholder={sourceName}
                    onChange={e => setVal(`name|${l.code}`, e.target.value)} />
                  <label style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{t('amTransDesc')}</label>
                  <textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={vals[`description|${l.code}`] ?? ''} placeholder={sourceDescription || '—'}
                    onChange={e => setVal(`description|${l.code}`, e.target.value)} />
                </div>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, alignItems: 'center' }}>
          {saved && <span style={{ fontSize: 13, color: 'var(--c-success)' }}>✓ {t('amTransSaved')}</span>}
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)', cursor: 'pointer' }}>{t('cancel')}</button>
          <button onClick={save} disabled={saving || loading} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--c-primary)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
            {saving ? t('amTransSaving') : t('amTransSave')}
          </button>
        </div>
      </div>
    </div>
  )
}
