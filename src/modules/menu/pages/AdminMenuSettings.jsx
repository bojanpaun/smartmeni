import { useState, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './GeneralSettings.module.css'
import menuStyles from './AdminMenu.module.css'

// ── Konstante ─────────────────────────────────────────────

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

const VIS_OPTIONS = [
  { value: 'off',        label: 'Isključeno' },
  { value: 'registered', label: 'Registrovani' },
  { value: 'all',        label: 'Svi' },
]

const TABS = [
  { id: 'opste',      label: 'Opšte' },
  { id: 'vidljivost', label: 'Vidljivost' },
  { id: 'poruke',     label: 'Poruke' },
]

// ── Sub-komponente ─────────────────────────────────────────

function DraggableList({ items, onReorder, children }) {
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
            <select value={m.icon} onChange={e => update(i, 'icon', e.target.value)}
              style={{ width: 54, padding: '7px 4px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 18, textAlign: 'center' }}>
              {ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
            </select>
            <input value={m.sr} onChange={e => update(i, 'sr', e.target.value)} placeholder="Tekst (SR)"
              style={{ flex: 1, padding: '8px 10px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' }} />
            <input value={m.en} onChange={e => update(i, 'en', e.target.value)} placeholder="Text (EN)"
              style={{ flex: 1, padding: '8px 10px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' }} />
            <button onClick={() => remove(i)}
              style={{ padding: '7px 10px', background: 'transparent', border: '1px solid #f5b0b0', borderRadius: 8, color: '#c0392b', cursor: 'pointer', fontSize: 13 }}>✕</button>
          </>
        )}
      </DraggableList>
      <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
        <button onClick={add}
          style={{ padding: '8px 14px', background: '#f0f5f2', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
          + Dodaj poruku
        </button>
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

  const update = (i, val) => setMessages(prev => prev.map((m, idx) => idx === i ? val : m))
  const remove = (i) => setMessages(prev => prev.filter((_, idx) => idx !== i))
  const add = () => { if (!newMsg.trim()) return; setMessages(prev => [...prev, newMsg.trim()]); setNewMsg('') }

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
            <input value={m} onChange={e => update(i, e.target.value)}
              style={{ flex: 1, padding: '8px 10px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' }} />
            <button onClick={() => remove(i)}
              style={{ padding: '7px 10px', background: 'transparent', border: '1px solid #f5b0b0', borderRadius: 8, color: '#c0392b', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>✕</button>
          </>
        )}
      </DraggableList>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input value={newMsg} onChange={e => setNewMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Nova poruka odbijanja..."
          style={{ flex: 1, padding: '8px 10px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' }} />
        <button onClick={add}
          style={{ padding: '8px 14px', background: '#f0f5f2', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
          + Dodaj
        </button>
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

function VisibilityControl({ value, onChange, label, icon, desc }) {
  return (
    <div className={styles.orderingCard}>
      <div className={styles.orderingInfo}>
        <div className={styles.orderingTitle}>{icon} {label}</div>
        <div className={styles.orderingDesc}>{desc}</div>
      </div>
      <div className={styles.segControl}>
        {VIS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            className={[
              styles.segBtn,
              value === opt.value ? styles.segBtnActive : '',
              value === opt.value && opt.value === 'off'        ? styles.segBtnOff : '',
              value === opt.value && opt.value === 'registered' ? styles.segBtnReg : '',
              value === opt.value && opt.value === 'all'        ? styles.segBtnAll : '',
            ].join(' ')}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function BookingButtonToggle({ restaurant, setRestaurant }) {
  const [enabled, setEnabled] = useState(restaurant.show_booking_button ?? false)
  const [saving, setSaving] = useState(false)

  const toggle = async () => {
    const next = !enabled
    setEnabled(next)
    setSaving(true)
    await supabase.from('restaurants').update({ show_booking_button: next }).eq('id', restaurant.id)
    setRestaurant(r => ({ ...r, show_booking_button: next }))
    setSaving(false)
  }

  const bookingUrl = `${window.location.origin}/${restaurant.slug}/book`

  return (
    <div className={styles.orderingCard}>
      <div className={styles.orderingInfo}>
        <div className={styles.orderingTitle}>🏨 Online rezervacija smještaja</div>
        <div className={styles.orderingDesc}>
          Plovuće dugme "Rezerviši" na meniju koje vodi na stranicu za rezervaciju.
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--c-primary)' }}>
            🔗 <a href={bookingUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{bookingUrl}</a>
          </div>
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        style={{
          width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
          background: enabled ? '#1a9e6e' : '#d0e4dc',
          position: 'relative', flexShrink: 0, transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: enabled ? 25 : 3,
          width: 20, height: 20, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  )
}

// ── Glavna komponenta ──────────────────────────────────────

export default function AdminMenuSettings() {
  const { restaurant, setRestaurant, hasAddon } = usePlatform()
  const hasHotel = hasAddon('hotel_core')
  const hasSpa   = hasAddon('spa_wellness')

  const [activeTab, setActiveTab] = useState('opste')
  const [form, setForm]     = useState(restaurant ? { ...restaurant } : null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]       = useState('')

  if (!restaurant || !form) return <div className={styles.loading}>Učitavanje...</div>

  const saveForm = async (e) => {
    e.preventDefault()
    setSaving(true)
    await supabase.from('restaurants').update(form).eq('id', restaurant.id)
    setRestaurant(form)
    setSaving(false)
    setMsg('Sačuvano!')
    setTimeout(() => setMsg(''), 2000)
  }

  // Instant save za visibility polja (bez forme)
  const toggleVis = async (field, val) => {
    setForm(f => ({ ...f, [field]: val }))
    await supabase.from('restaurants').update({ [field]: val }).eq('id', restaurant.id)
    setRestaurant(r => ({ ...r, [field]: val }))
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Postavke menija</h1>
        <p className={styles.subtitle}>Upravljanje digitalnim menijem, vidljivošću i porukama.</p>
      </div>

      {/* ── Tab navigacija ── */}
      <div className={styles.tabs}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Opšte ── */}
      {activeTab === 'opste' && (
        <div className={menuStyles.card}>
          <div className={menuStyles.cardTitle}>Podaci o restoranu</div>
          <form onSubmit={saveForm} className={menuStyles.settingsForm}>
            <div className={menuStyles.modalGrid}>
              <div className={menuStyles.field}>
                <label>Naziv restorana</label>
                <input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
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
              <div className={menuStyles.field} style={{ gridColumn: '1 / -1' }}>
                <label>Opis restorana</label>
                <textarea
                  value={form.description || ''}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Kratki opis restorana koji gosti vide u meniju..."
                  rows={3}
                  className={styles.textarea}
                />
                <div className={styles.fieldHint}>Prikazuje se ispod naziva restorana u guest meniju. Max 200 karaktera.</div>
              </div>
              <div className={menuStyles.field} style={{ gridColumn: '1 / -1' }}>
                <label>Boja brenda (hex)</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input type="color" value={form.color || '#0d7a52'}
                    onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                    style={{ width: 40, height: 36, padding: 2, border: '1px solid #d0e4dc', borderRadius: 8 }} />
                  <input value={form.color || '#0d7a52'}
                    onChange={e => setForm(f => ({ ...f, color: e.target.value }))} style={{ flex: 1 }} />
                </div>
              </div>
              <div className={menuStyles.field} style={{ gridColumn: '1 / -1' }}>
                <label>📱 Trajanje QR sesije</label>
                <select
                  value={form.qr_session_minutes || 30}
                  onChange={e => setForm(f => ({ ...f, qr_session_minutes: parseInt(e.target.value) }))}
                  style={{ padding: '8px 10px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
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
                <div className={styles.fieldHint}>Nakon isteka, gost mora ponovo skenirati QR kod da bi mogao naručivati i zvati konobara.</div>
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
      )}

      {/* ── Tab: Vidljivost ── */}
      {activeTab === 'vidljivost' && (
        <>
          <div className={styles.sectionLabel}>Vidljivost u digitalnom meniju</div>
          <div className={styles.visDesc}>Za svaku opciju odaberi ko je može vidjeti u guest meniju</div>

          <VisibilityControl icon="🛒" label="Digitalno naručivanje" desc="Ko može naručivati iz menija"
            value={form.ordering_visibility || 'all'} onChange={val => toggleVis('ordering_visibility', val)} />
          <VisibilityControl icon="🔔" label="Poziv konobara" desc="Ko može pozvati konobara"
            value={form.waiter_visibility || 'all'} onChange={val => toggleVis('waiter_visibility', val)} />
          <VisibilityControl icon="📅" label="Online rezervacije" desc="Ko može rezervisati sto"
            value={form.reservation_visibility || 'all'} onChange={val => toggleVis('reservation_visibility', val)} />
          <VisibilityControl icon="🎟️" label="Registracija gostiju" desc="Ko vidi dugme Postani naš gost i Prijava"
            value={form.registration_visibility || 'all'} onChange={val => toggleVis('registration_visibility', val)} />
          {hasHotel && (
            <VisibilityControl icon="🏨" label="Hotel — info i smještaj" desc="Ko vidi link prema hotelskoj stranici u meniju"
              value={form.hotel_visibility || 'off'} onChange={val => toggleVis('hotel_visibility', val)} />
          )}
          {hasSpa && (
            <VisibilityControl icon="✨" label="Spa & Wellness" desc="Ko vidi link prema spa booking stranici u meniju"
              value={form.spa_visibility || 'off'} onChange={val => toggleVis('spa_visibility', val)} />
          )}

          <div className={styles.sectionLabel} style={{ marginTop: 28 }}>Rezervacija smještaja</div>
          <div className={styles.visDesc}>Dugme za online booking koje se prikazuje na gostovoj stranici</div>
          <BookingButtonToggle restaurant={restaurant} setRestaurant={setRestaurant} />
        </>
      )}

      {/* ── Tab: Poruke ── */}
      {activeTab === 'poruke' && (
        <>
          <WaiterMessagesEditor restaurant={restaurant} setRestaurant={setRestaurant} />
          <RejectionMessagesEditor restaurant={restaurant} setRestaurant={setRestaurant} />
        </>
      )}
    </div>
  )
}
