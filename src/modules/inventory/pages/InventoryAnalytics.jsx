// src/modules/inventory/pages/InventoryAnalytics.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import gsStyles from '../../menu/pages/GeneralSettings.module.css'

export default function InventoryAnalytics() {
  const { restaurant } = usePlatform()
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

  if (loading) return <div className={gsStyles.loading}>Učitavanje...</div>

  const totalItems   = items.length
  const lowItems     = items.filter(i => i.min_quantity && i.quantity < i.min_quantity)
  const totalValue   = items.reduce((s, i) => s + ((i.quantity || 0) * (i.cost_per_unit || 0)), 0)
  const inMoves      = movements.filter(m => m.type === 'in' || m.quantity > 0).length
  const outMoves     = movements.filter(m => m.type === 'out' || m.quantity < 0).length

  // Kategorije
  const byCategory = items.reduce((acc, i) => {
    const cat = i.category || 'Ostalo'
    if (!acc[cat]) acc[cat] = { count: 0, value: 0 }
    acc[cat].count++
    acc[cat].value += (i.quantity || 0) * (i.cost_per_unit || 0)
    return acc
  }, {})

  const metrics = [
    { label: 'Ukupno stavki', value: totalItems },
    { label: 'Ispod minimuma', value: lowItems.length, color: lowItems.length > 0 ? '#a32d2d' : '#0d7a52' },
    { label: 'Vrijednost zaliha', value: `€${totalValue.toFixed(0)}`, color: '#0d7a52' },
    { label: 'Ulazi (30 dana)', value: inMoves, color: '#0d7a52' },
    { label: 'Izlazi (30 dana)', value: outMoves, color: '#ba7517' },
  ]

  return (
    <div className={gsStyles.page} style={{ maxWidth: 900 }}>
      <div className={gsStyles.header}>
        <h1 className={gsStyles.title}>Analitika zaliha</h1>
        <p className={gsStyles.subtitle}>Pregled inventara, vrijednosti i promjena za posljednjih 30 dana.</p>
      </div>

      {/* Metrike */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 14, marginBottom: 24 }}>
        {metrics.map((m, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid #e0ece6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 12, color: '#8a9e96', fontWeight: 500, marginBottom: 8 }}>{m.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: m.color || '#1a2e26', lineHeight: 1 }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Stavke ispod minimuma */}
      {lowItems.length > 0 && (
        <div style={{ background: '#fff8f5', border: '1px solid #f5c0a0', borderRadius: 14, padding: '18px 22px', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#a32d2d', marginBottom: 12 }}>
            ⚠️ Stavke ispod minimuma ({lowItems.length})
          </div>
          {lowItems.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f5e0d8', fontSize: 13 }}>
              <span style={{ fontWeight: 500, color: '#1a2e26' }}>{item.name}</span>
              <span style={{ color: '#a32d2d', fontWeight: 600 }}>
                {item.quantity} {item.unit} <span style={{ color: '#b0c0b8', fontWeight: 400 }}>/ min {item.min_quantity}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Po kategorijama */}
      {Object.keys(byCategory).length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e0ece6', padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0e1a14', marginBottom: 16 }}>Po kategorijama</div>
          {Object.entries(byCategory).sort(([,a],[,b]) => b.count - a.count).map(([cat, data]) => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ width: 120, fontSize: 13, color: '#5a7a6a', fontWeight: 500, flexShrink: 0 }}>{cat}</div>
              <div style={{ flex: 1, background: '#f0f5f2', borderRadius: 6, height: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 6, background: '#0d7a52', width: `${(data.count / totalItems) * 100}%` }} />
              </div>
              <div style={{ fontSize: 12, color: '#8a9e96', minWidth: 80, textAlign: 'right' }}>
                {data.count} st. · €{data.value.toFixed(0)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zadnje promjene */}
      {movements.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e0ece6', padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0e1a14', marginBottom: 14 }}>Nedavne promjene</div>
          {movements.slice(0, 8).map(m => {
            const isIn = m.type === 'in' || m.quantity > 0
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f0f5f2' }}>
                <span style={{ fontSize: 16 }}>{isIn ? '📥' : '📤'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1a2e26' }}>{m.item_name || m.note || '—'}</div>
                  <div style={{ fontSize: 11, color: '#8a9e96' }}>
                    {new Date(m.created_at).toLocaleDateString('sr-Latn')} · {m.note || ''}
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: isIn ? '#0d7a52' : '#ba7517' }}>
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
