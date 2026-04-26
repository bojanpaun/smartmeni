// src/modules/menu/pages/AdminMenuSettings.jsx
import { useState, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './GeneralSettings.module.css'
import menuStyles from './AdminMenu.module.css'

const DEFAULT_WAITER_MESSAGES = [
  { sr: 'Pozovi konobara', en: 'Call waiter', icon: '🔔' },
  { sr: 'Donesi račun – plaćam u kešu', en: 'Bring the bill – paying with cash', icon: '🧾' },
  { sr: 'Donesi vodu', en: 'Bring water', icon: '🥤' },
  { sr: 'Skloni prazne tanjire', en: 'Clear the table', icon: '🍽️' },
]

const DEFAULT_REJECTION_MESSAGES = [
  'Žao nam je, ovaj artikal trenutno nije dostupan.',
  'Kuhinja je zauzeta, molimo pokušajte malo kasnije.',
  'Narudžba je primljena greškom, molimo naručite ponovo.',
  'Restoran se zatvara, narudžba nije moguća.',
]

const ICONS = ['🔔','🧾','🥤','🍽️','☕','🍷','🧂','❓','👋','🛎️']

function DraggableList({ children, onReorder, items }) {
  const dragIdx = useRef(null)
  return (
    <div>
      {items.map((item, i) => (
        <div
          key={i}
          draggable
          onDragStart={() => { dragIdx.current = i }}
          onDragOver={e => e.preventDefault()}
          onDrop={() => {
            if (dragIdx.current === null || dragIdx.current === i) return
            const next = [...items]
            const [moved] = next.splice(dragIdx.current, 1)
            next.splice(i, 0, moved)
            dragIdx.current = null
            onReorder(next)
          }}
          style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, cursor: 'grab' }}
        >
          <span style={{ color: '#b0c0b8', fontSize: 16, flexShrink: 0, userSelect: 'none' }}>⠿</span>
          {children(item, i)}
        </div>
      ))}
    </div>
  )
}

function WaiterMessagesEditor({ restaurant, setRestaurant }) {
  const [messages, setMessages] = useState(restaurant.waiter_messages || DEFAULT_WAITER_MESSAGES)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const update = (i, field, val) =>
    setMessages(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m))

  const remove = (i) => setMessages(prev => prev.filter((_, idx) => idx !== i))

  const add = () => setMessages(prev => [...prev, { sr: '', en: '', icon: '🔔' }])

  const save = async () => {
    setSaving(true)
    await supabase.from('restaurants').update({ waiter_messages: messages }).eq('id', restaurant.id)
    setRestaurant(r => ({ ...r, waiter_messages: messages }))
    setSaving(false)
    setMsg('Sačuvano!')
    setTimeout(() => setMsg(''), 2000)
  }

  return (
    <div className={menuStyles.card} style={{ marginBottom: 16 }}>
      <div className={menuStyles.cardTitle}>🔔 Poruke za poziv konobara</div>
      <div style={{ fontSize: 12, color: '#8a9e96', marginBottom: 14 }}>
        Gosti biraju jednu od ovih poruka kada pozivaju konobara. Povuci za promjenu redosljeda.
      </div>
      <DraggableList items={messages} onReorder={setMessages}>
        {(m, i) => (
          <>
            <select
              value={m.icon}
              onChange={e => update(i, 'icon', e.target.value)}
              style={{ width: 54, padding: '7px 4px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 18, textAlign: 'center' }}
            >
              {ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
            </select>
            <input
              value={m.sr}
              onChange={e => update(i, 'sr', e.target.value)}
              placeholder="Tekst (SR)"
              style={{ flex: 1, padding: '8px 10px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
            />
            <input
              value={m.en}
              onChange={e => update(i, 'en', e.target.value)}
              placeholder="Text (EN)"
              style={{ flex: 1, padding: '8px 10px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
            />
            <button
              onClick={() => remove(i)}
              style={{ padding: '7px 10px', background: 'transparent', border: '1px solid #f5b0b0', borderRadius: 8, color: '#c0392b', cursor: 'pointer', fontSize: 13 }}
            >✕</button>
          </>
        )}
      </DraggableList>
      <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
        <button
          onClick={add}
          style={{ padding: '8px 14px', background: '#f0f5f2', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
        >+ Dodaj poruku</button>
        <button onClick={save} className={menuStyles.btnSave} disabled={saving}>
          {saving ? 'Čuvanje...' : 'Sačuvaj poruke'}
        </button>
        {msg && <span style={{ color: '#0d7a52', fontSize: 13 }}>✓ {msg}</span>}
      </div>
    </div>
  )
}

function RejectionMessagesEditor({ restaurant, setRestaurant }) {
  const [messages, setMessages] = useState(restaurant.rejection_messages || DEFAULT_REJECTION_MESSAGES)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [newMsg, setNewMsg] = useState('')

  const update = (i, val) =>
    setMessages(prev => prev.map((m, idx) => idx === i ? val : m))

  const remove = (i) => setMessages(prev => prev.filter((_, idx) => idx !== i))

  const add = () => {
    if (!newMsg.trim()) return
    setMessages(prev => [...prev, newMsg.trim()])
    setNewMsg('')
  }

  const save = async () => {
    setSaving(true)
    await supabase.from('restaurants').update({ rejection_messages: messages }).eq('id', restaurant.id)
    setRestaurant(r => ({ ...r, rejection_messages: messages }))
    setSaving(false)
    setMsg('Sačuvano!')
    setTimeout(() => setMsg(''), 2000)
  }

  return (
    <div className={menuStyles.card}>
      <div className={menuStyles.cardTitle}>✕ Poruke odbijanja narudžbe</div>
      <div style={{ fontSize: 12, color: '#8a9e96', marginBottom: 14 }}>
        Konobar bira jednu od ovih poruka kad odbija narudžbu. Gost je vidi na trackeru. Povuci za promjenu redosljeda.
      </div>
      <DraggableList items={messages} onReorder={setMessages}>
        {(m, i) => (
          <>
            <input
              value={m}
              onChange={e => update(i, e.target.value)}
              style={{ flex: 1, padding: '8px 10px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
            />
            <button
              onClick={() => remove(i)}
              style={{ padding: '7px 10px', background: 'transparent', border: '1px solid #f5b0b0', borderRadius: 8, color: '#c0392b', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}
            >✕</button>
          </>
        )}
      </DraggableList>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          value={newMsg}
          onChange={e => setNewMsg(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Nova poruka odbijanja..."
          style={{ flex: 1, padding: '8px 10px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
        />
        <button
          onClick={add}
          style={{ padding: '8px 14px', background: '#f0f5f2', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
        >+ Dodaj</button>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
        <button onClick={save} className={menuStyles.btnSave} disabled={saving}>
          {saving ? 'Čuvanje...' : 'Sačuvaj poruke'}
        </button>
        {msg && <span style={{ color: '#0d7a52', fontSize: 13 }}>✓ {msg}</span>}
      </div>
    </div>
  )
}

export default function AdminMenuSettings() {
  const { restaurant, setRestaurant } = usePlatform()
  const [form, setForm] = useState(restaurant ? { ...restaurant } : null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  if (!restaurant || !form) return <div className={styles.loading}>Učitavanje...</div>

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    await supabase.from('restaurants').update(form).eq('id', restaurant.id)
    setRestaurant(form)
    setSaving(false)
    setMsg('Sačuvano!')
    setTimeout(() => setMsg(''), 2000)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Postavke menija</h1>
        <p className={styles.subtitle}>Podaci restorana i poruke za goste i konobara.</p>
      </div>

      {/* Podaci restorana */}
      <div className={menuStyles.card} style={{ marginBottom: 16 }}>
        <div className={menuStyles.cardTitle}>Podaci o restoranu</div>
        <form onSubmit={save} className={menuStyles.settingsForm}>
          <div className={menuStyles.modalGrid}>
            <div className={menuStyles.field}>
              <label>Naziv restorana</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className={menuStyles.field}>
              <label>Lokacija</label>
              <input value={form.location || ''} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div className={menuStyles.field}>
              <label>Telefon</label>
              <input value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className={menuStyles.field}>
              <label>Radno vrijeme</label>
              <input value={form.hours || ''} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} />
            </div>
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label>Boja brenda (hex)</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="color" value={form.color || '#0d7a52'}
                  onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  style={{ width: 40, height: 36, padding: 2, border: '1px solid #d0e4dc', borderRadius: 8 }} />
                <input value={form.color || '#0d7a52'}
                  onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  style={{ flex: 1 }} />
              </div>
            </div>
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label>📱 Trajanje QR sesije</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <select
                  value={form.qr_session_minutes || 30}
                  onChange={e => setForm(f => ({ ...f, qr_session_minutes: parseInt(e.target.value) }))}
                  style={{ flex: 1, padding: '8px 10px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
                >
                  <option value={10}>10 minuta</option>
                  <option value={15}>15 minuta</option>
                  <option value={20}>20 minuta</option>
                  <option value={30}>30 minuta (preporučeno)</option>
                  <option value={45}>45 minuta</option>
                  <option value={60}>60 minuta</option>
                  <option value={90}>90 minuta</option>
                  <option value={120}>2 sata</option>
                </select>
              </div>
              <div style={{ fontSize: 11, color: '#8a9e96', marginTop: 4 }}>
                Nakon isteka, gost mora ponovo skenirati QR kod da bi mogao naručivati i zvati konobara.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <button type="submit" className={menuStyles.btnSave} disabled={saving}>
              {saving ? 'Čuvanje...' : 'Sačuvaj promjene'}
            </button>
            {msg && <span style={{ color: '#0d7a52', fontSize: 13 }}>✓ {msg}</span>}
          </div>
        </form>
      </div>

      <WaiterMessagesEditor restaurant={restaurant} setRestaurant={setRestaurant} />
      <RejectionMessagesEditor restaurant={restaurant} setRestaurant={setRestaurant} />
    </div>
  )
}
