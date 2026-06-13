import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import gsStyles from '../../menu/pages/GeneralSettings.module.css'

const CAT_KEYS = {
  namirnice: 'invCatNamirnice', 'piće': 'invCatPice', alkohol: 'invCatAlkohol',
  'začini': 'invCatZacini', 'ambalaža': 'invCatAmbalaza', ostalo: 'invCatOstalo',
}

export default function InventoryAnalytics() {
  const { restaurant } = usePlatform()
  const { t, i18n } = useTranslation('admin')
  const dl = i18n.language === 'en' ? 'en-US' : 'sr-Latn'
  const catLabel = (c) => t(CAT_KEYS[c] || 'invCatOstalo')
  const [items, setItems] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!restaurant) return
    Promise.all([
      supabase.from('inventory_items').select('*').eq('restaurant_id', restaurant.id),
      supabase.from('inventory_movements').select('*').eq('restaurant_id', restaurant.id)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false }),
    ]).then(([it, mv]) => {
      setItems(it.data || [])
      setMovements(mv.data || [])
      setLoading(false)
    })
  }, [restaurant])

  if (loading) return <div className={gsStyles.loading}>{t('loading')}</div>

  const totalItems   = items.length
  const lowItems     = items.filter(i => i.min_quantity && i.quantity < i.min_quantity)
  const totalValue   = items.reduce((s, i) => s + ((i.quantity || 0) * (i.cost_per_unit || 0)), 0)
  const inMoves      = movements.filter(m => m.type === 'in' || m.quantity > 0).length
  const outMoves     = movements.filter(m => m.type === 'out' || m.quantity < 0).length

  // Kategorije
  const byCategory = items.reduce((acc, i) => {
    const cat = i.category || 'ostalo'
    if (!acc[cat]) acc[cat] = { count: 0, value: 0 }
    acc[cat].count++
    acc[cat].value += (i.quantity || 0) * (i.cost_per_unit || 0)
    return acc
  }, {})

  const metrics = [
    { label: t('iaTotalItems'), value: totalItems },
    { label: t('invBelowMin'), value: lowItems.length, color: lowItems.length > 0 ? 'var(--c-danger)' : 'var(--c-primary)' },
    { label: t('iaStockValue'), value: `€${totalValue.toFixed(0)}`, color: 'var(--c-primary)' },
    { label: t('iaInflows'), value: inMoves, color: 'var(--c-primary)' },
    { label: t('iaOutflows'), value: outMoves, color: 'var(--c-warning)' },
  ]

  return (
    <div className={gsStyles.page} style={{ maxWidth: 900 }}>
      <div className={gsStyles.header}>
        <h1 className={gsStyles.title}>{t('iaTitle')}</h1>
        <p className={gsStyles.subtitle}>{t('iaSubtitle')}</p>
      </div>

      {/* Metrike */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 14, marginBottom: 24 }}>
        {metrics.map((m, i) => (
          <div key={i} style={{ background: 'var(--c-surface)', borderRadius: 14, padding: '18px 20px', border: '1px solid var(--c-border)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 12, color: 'var(--c-text-muted)', fontWeight: 500, marginBottom: 8 }}>{m.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: m.color || 'var(--c-text)', lineHeight: 1 }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Stavke ispod minimuma */}
      {lowItems.length > 0 && (
        <div style={{ background: 'var(--c-danger-bg)', border: '1px solid var(--c-danger-border)', borderRadius: 14, padding: '18px 22px', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-danger)', marginBottom: 12 }}>
            ⚠️ {t('iaItemsBelowMin')} ({lowItems.length})
          </div>
          {lowItems.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--c-danger-border)', fontSize: 13 }}>
              <span style={{ fontWeight: 500, color: 'var(--c-text)' }}>{item.name}</span>
              <span style={{ color: 'var(--c-danger)', fontWeight: 600 }}>
                {item.quantity} {item.unit} <span style={{ color: 'var(--c-text-muted)', fontWeight: 400 }}>/ {t('iaMin')} {item.min_quantity}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Po kategorijama */}
      {Object.keys(byCategory).length > 0 && (
        <div style={{ background: 'var(--c-surface)', borderRadius: 14, border: '1px solid var(--c-border)', padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', marginBottom: 16 }}>{t('iaByCategory')}</div>
          {Object.entries(byCategory).sort(([,a],[,b]) => b.count - a.count).map(([cat, data]) => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ width: 120, fontSize: 13, color: 'var(--c-text-medium)', fontWeight: 500, flexShrink: 0 }}>{catLabel(cat)}</div>
              <div style={{ flex: 1, background: 'var(--c-bg-subtle)', borderRadius: 6, height: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 6, background: 'var(--c-primary)', width: `${(data.count / totalItems) * 100}%` }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--c-text-muted)', minWidth: 80, textAlign: 'right' }}>
                {data.count} {t('iaItemsShort')} · €{data.value.toFixed(0)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zadnje promjene */}
      {movements.length > 0 && (
        <div style={{ background: 'var(--c-surface)', borderRadius: 14, border: '1px solid var(--c-border)', padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', marginBottom: 14 }}>{t('iaRecentChanges')}</div>
          {movements.slice(0, 8).map(m => {
            const isIn = m.type === 'in' || m.quantity > 0
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--c-border)' }}>
                <span style={{ fontSize: 16 }}>{isIn ? '📥' : '📤'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text)' }}>{m.item_name || m.note || '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>
                    {new Date(m.created_at).toLocaleDateString(dl)} · {m.note || ''}
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: isIn ? 'var(--c-primary)' : 'var(--c-warning)' }}>
                  {isIn ? '+' : ''}{m.quantity}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
