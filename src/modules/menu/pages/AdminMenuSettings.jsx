import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { stripAccountFields } from '../../../lib/planUtils'
import { translateContent, restaurantDescriptionFields } from '../../../lib/contentTranslate'
import { usePlatform } from '../../../context/PlatformContext'
import TemplateSettings from './TemplateSettings'
import ContentTranslations from '../../../components/shared/ContentTranslations'
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
  { value: 'off',        labelKey: 'visOff' },
  { value: 'registered', labelKey: 'visRegistered' },
  { value: 'all',        labelKey: 'visAll' },
]

const TABS = [
  { id: 'opste',      labelKey: 'msTabGeneral' },
  { id: 'vidljivost', labelKey: 'msTabVisibility' },
  { id: 'poruke',     labelKey: 'msTabMessages' },
  { id: 'predlosci',  labelKey: 'msTabTemplates' },
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
          style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, cursor: 'grab', flexWrap: 'wrap' }}
        >
          <span style={{ color: '#b0c0b8', fontSize: 16, flexShrink: 0, userSelect: 'none' }}>⠿</span>
          {children(item, i)}
        </div>
      ))}
    </div>
  )
}

function WaiterMessagesEditor({ restaurant, setRestaurant }) {
  const { t } = useTranslation('admin')
  // Stabilan id po poruci (ključ za content_translations); stara forma {sr,en} →
  // {id,icon,sr}, `sr` izvor, `en` se odbacuje (prevodi AI).
  const newId = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const [messages, setMessages] = useState(() =>
    (restaurant.waiter_messages || DEFAULT_WAITER_MESSAGES).map(m => ({
      id: m.id || newId(), icon: m.icon || '🔔', sr: m.sr ?? m.text ?? '',
    }))
  )
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [trMsg, setTrMsg] = useState(null) // poruka čiji se 🌐 override editor otvara

  const update = (i, field, val) =>
    setMessages(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m))
  const remove = (i) => setMessages(prev => prev.filter((_, idx) => idx !== i))
  const add = () => setMessages(prev => [...prev, { id: newId(), sr: '', icon: '🔔' }])

  const save = async () => {
    setSaving(true)
    await supabase.from('restaurants').update({ waiter_messages: messages }).eq('id', restaurant.id)
    setRestaurant(r => ({ ...r, waiter_messages: messages }))
    const items = messages.filter(m => m.sr?.trim()).map(m => ({ entity_type: 'waiter_message', entity_id: m.id, field: 'text', text: m.sr }))
    translateContent(restaurant.id, items).catch(() => {})
    setSaving(false)
    setMsg(t('saved'))
    setTimeout(() => setMsg(''), 2000)
  }

  return (
    <div className={menuStyles.card} style={{ marginBottom: 16 }}>
      <div className={menuStyles.cardTitle}>🔔 {t('amWaiterMsgTitle')}</div>
      <div style={{ fontSize: 12, color: '#8a9e96', marginBottom: 14 }}>
        {t('msWaiterHintDrag')} {t('amWaiterMsgNote')} {t('amTransPageHint')}
      </div>
      <DraggableList items={messages} onReorder={setMessages}>
        {(m, i) => (
          <>
            <select value={m.icon} onChange={e => update(i, 'icon', e.target.value)}
              style={{ width: 54, padding: '7px 4px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 18, textAlign: 'center' }}>
              {ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
            </select>
            <input value={m.sr} onChange={e => update(i, 'sr', e.target.value)} placeholder={t('amTextField')}
              style={{ flex: 1, minWidth: 160, padding: '8px 10px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' }} />
            <button type="button" onClick={() => setTrMsg(m)} title={t('amTransTitle')} disabled={!m.sr?.trim()}
              style={{ padding: '7px 10px', background: 'transparent', border: '1px solid var(--c-border-input)', borderRadius: 8, cursor: m.sr?.trim() ? 'pointer' : 'not-allowed', opacity: m.sr?.trim() ? 1 : 0.4, fontSize: 13, whiteSpace: 'nowrap', color: 'var(--c-text-medium)', fontFamily: 'DM Sans, sans-serif' }}>🌐 {t('amTransShort')}</button>
            <button onClick={() => remove(i)}
              style={{ padding: '7px 10px', background: 'transparent', border: '1px solid #f5b0b0', borderRadius: 8, color: '#c0392b', cursor: 'pointer', fontSize: 13 }}>✕</button>
          </>
        )}
      </DraggableList>
      {trMsg && (
        <ContentTranslations
          restaurantId={restaurant.id}
          entityType="waiter_message"
          entityId={trMsg.id}
          headerTitle={trMsg.sr}
          fields={[{ key: 'text', labelKey: 'amTextField', source: trMsg.sr, multiline: true }]}
          onClose={() => setTrMsg(null)}
        />
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
        <button onClick={add}
          style={{ padding: '8px 14px', background: '#f0f5f2', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
          + {t('amAddMessage')}
        </button>
        <button onClick={save} className={menuStyles.btnSave} disabled={saving}>
          {saving ? t('saving') : t('amSaveMessages')}
        </button>
        {msg && <span style={{ color: '#0d7a52', fontSize: 13 }}>✓ {msg}</span>}
      </div>
    </div>
  )
}

function RejectionMessagesEditor({ restaurant, setRestaurant }) {
  const { t } = useTranslation('admin')
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
    setMsg(t('saved'))
    setTimeout(() => setMsg(''), 2000)
  }

  return (
    <div className={menuStyles.card}>
      <div className={menuStyles.cardTitle}>✕ {t('msRejectTitle')}</div>
      <div style={{ fontSize: 12, color: '#8a9e96', marginBottom: 14 }}>
        {t('msRejectHint')}
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
          placeholder={t('msNewRejectPlaceholder')}
          style={{ flex: 1, padding: '8px 10px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' }} />
        <button onClick={add}
          style={{ padding: '8px 14px', background: '#f0f5f2', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
          + {t('add')}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
        <button onClick={save} className={menuStyles.btnSave} disabled={saving}>
          {saving ? t('saving') : t('amSaveMessages')}
        </button>
        {msg && <span style={{ color: '#0d7a52', fontSize: 13 }}>✓ {msg}</span>}
      </div>
    </div>
  )
}

function VisibilityControl({ value, onChange, label, icon, desc }) {
  const { t } = useTranslation('admin')
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
            {t(opt.labelKey)}
          </button>
        ))}
      </div>
    </div>
  )
}

function BookingButtonToggle({ restaurant, setRestaurant }) {
  const { t } = useTranslation('admin')
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
        <div className={styles.orderingTitle}>🏨 {t('msBookingTitle')}</div>
        <div className={styles.orderingDesc}>
          {t('msBookingDesc')}
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
  const { t } = useTranslation('admin')
  const { restaurant, setRestaurant, hasAddon, hasVertical } = usePlatform()
  // Hotel/spa/booking opcije se nude SAMO ako nalog ima hotel vertikalu (šta vodi),
  // a ne na osnovu addona — addon je pod beta modom svima true, pa bi se inače
  // pokazivali i restoranu-only nalogu. Spa dodatno traži spa_wellness addon.
  const hasHotel = hasVertical('hotel')
  const hasSpa   = hasVertical('hotel') && hasAddon('spa_wellness')

  const [activeTab, setActiveTab] = useState('opste')
  const [form, setForm]     = useState(restaurant ? { ...restaurant } : null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]       = useState('')

  if (!restaurant || !form) return <div className={styles.loading}>{t('loading')}</div>

  const saveForm = async (e) => {
    e.preventDefault()
    setSaving(true)
    // Boja brenda se uređuje u Postavke → Brend (kanonski izvor) — ne diraj je odavde.
    const { color, ...rest } = form
    await supabase.from('restaurants').update(stripAccountFields(rest)).eq('id', restaurant.id)
    setRestaurant({ ...restaurant, ...rest })
    setSaving(false)
    setMsg(t('saved'))
    setTimeout(() => setMsg(''), 2000)
    // AI prevod opisa objekta (fire-and-forget) — prikazuje se kao hero podnaslov na landingu.
    translateContent(restaurant.id, restaurantDescriptionFields(restaurant.id, rest.description)).catch(() => {})
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
        <h1 className={styles.title}>{t('navMenuSettings')}</h1>
        <p className={styles.subtitle}>{t('msSubtitle')}</p>
      </div>

      {/* ── Tab navigacija ── */}
      <div className={styles.tabs}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* ── Tab: Opšte ── */}
      {activeTab === 'opste' && (
        <div className={menuStyles.card}>
          <div className={menuStyles.cardTitle}>{t('amRestaurantData')}</div>
          <form onSubmit={saveForm} className={menuStyles.settingsForm}>
            <div className={menuStyles.modalGrid}>
              <div className={menuStyles.field}>
                <label>{t('amRestaurantName')}</label>
                <input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className={menuStyles.field}>
                <label>{t('amLocation')}</label>
                <input value={form.location || ''} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
              </div>
              <div className={menuStyles.field}>
                <label>{t('amPhone')}</label>
                <input value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className={menuStyles.field}>
                <label>{t('amHours')}</label>
                <input value={form.hours || ''} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} />
              </div>
              <div className={menuStyles.field} style={{ gridColumn: '1 / -1' }}>
                <label>{t('msDescLabel')}</label>
                <textarea
                  value={form.description || ''}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder={t('msDescPlaceholder')}
                  rows={3}
                  className={styles.textarea}
                />
                <div className={styles.fieldHint}>{t('msDescHint')}</div>
              </div>
              <div className={menuStyles.field} style={{ gridColumn: '1 / -1' }}>
                <label>📱 {t('msQrSession')}</label>
                <select
                  value={form.qr_session_minutes || 30}
                  onChange={e => setForm(f => ({ ...f, qr_session_minutes: parseInt(e.target.value) }))}
                  style={{ padding: '8px 10px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
                >
                  <option value={10}>10 {t('msMinutes')}</option>
                  <option value={15}>15 {t('msMinutes')}</option>
                  <option value={20}>20 {t('msMinutes')}</option>
                  <option value={30}>30 {t('msMinutes')} ({t('msRecommended')})</option>
                  <option value={45}>45 {t('msMinutes')}</option>
                  <option value={60}>60 {t('msMinutes')}</option>
                  <option value={90}>90 {t('msMinutes')}</option>
                  <option value={120}>{t('msTwoHours')}</option>
                </select>
                <div className={styles.fieldHint}>{t('msQrSessionHint')}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <button type="submit" className={menuStyles.btnSave} disabled={saving}>
                {saving ? t('saving') : t('amSaveChanges')}
              </button>
              {msg && <span style={{ color: '#0d7a52', fontSize: 13 }}>✓ {msg}</span>}
            </div>
          </form>
        </div>
      )}

      {/* ── Tab: Vidljivost ── */}
      {activeTab === 'vidljivost' && (
        <>
          <div className={styles.sectionLabel}>{t('msVisSection')}</div>
          <div className={styles.visDesc}>{t('msVisDesc')}</div>

          <VisibilityControl icon="🛒" label={t('msVisOrderingLabel')} desc={t('msVisOrderingDesc')}
            value={form.ordering_visibility || 'all'} onChange={val => toggleVis('ordering_visibility', val)} />
          <VisibilityControl icon="🔔" label={t('msVisWaiterLabel')} desc={t('msVisWaiterDesc')}
            value={form.waiter_visibility || 'all'} onChange={val => toggleVis('waiter_visibility', val)} />
          <VisibilityControl icon="📅" label={t('msVisReservationLabel')} desc={t('msVisReservationDesc')}
            value={form.reservation_visibility || 'all'} onChange={val => toggleVis('reservation_visibility', val)} />
          <VisibilityControl icon="🎟️" label={t('msVisRegistrationLabel')} desc={t('msVisRegistrationDesc')}
            value={form.registration_visibility || 'all'} onChange={val => toggleVis('registration_visibility', val)} />
          {hasHotel && (
            <VisibilityControl icon="🏨" label={t('msVisHotelLabel')} desc={t('msVisHotelDesc')}
              value={form.hotel_visibility || 'off'} onChange={val => toggleVis('hotel_visibility', val)} />
          )}
          {hasSpa && (
            <VisibilityControl icon="✨" label={t('modSpa')} desc={t('msVisSpaDesc')}
              value={form.spa_visibility || 'off'} onChange={val => toggleVis('spa_visibility', val)} />
          )}

          {hasHotel && (
            <>
              <div className={styles.sectionLabel} style={{ marginTop: 28 }}>{t('msAccomReservation')}</div>
              <div className={styles.visDesc}>{t('msBookingToggleDesc')}</div>
              <BookingButtonToggle restaurant={restaurant} setRestaurant={setRestaurant} />
            </>
          )}
        </>
      )}

      {/* ── Tab: Poruke ── */}
      {activeTab === 'poruke' && (
        <>
          <WaiterMessagesEditor restaurant={restaurant} setRestaurant={setRestaurant} />
          <RejectionMessagesEditor restaurant={restaurant} setRestaurant={setRestaurant} />
        </>
      )}

      {/* ── Tab: Predlošci ── */}
      {activeTab === 'predlosci' && <TemplateSettings />}
    </div>
  )
}
