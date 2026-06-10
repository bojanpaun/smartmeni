import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'

// Editor custom paleta (superadmin). Bira 7 brend tokena za light i dark;
// ostali tokeni naslijede bazni green / green-dark. Vidi useTheme.js + migraciju
// 20260610120000_theme_palettes.sql.

const TOKENS = [
  ['primary',       'Primarna'],
  ['primaryHover',  'Primarna — hover'],
  ['primaryMedium', 'Primarna — medium'],
  ['primaryLight',  'Primarna — svijetla'],
  ['primaryMuted',  'Primarna — muted'],
  ['sbBg',          'Sidebar pozadina'],
  ['sbAccent',      'Sidebar akcent'],
]

const DEFAULT_LIGHT = { primary: '#0d7a52', primaryHover: '#0a6343', primaryMedium: '#1d9e75', primaryLight: '#e0f5ec', primaryMuted: '#9ad4be', sbBg: '#0d2b1e', sbAccent: '#5dcaa5' }
const DEFAULT_DARK  = { primary: '#1d9e75', primaryHover: '#25b882', primaryMedium: '#5dcaa5', primaryLight: '#173d30', primaryMuted: '#2d6b55', sbBg: '#081a10', sbAccent: '#5dcaa5' }

const slugify = (s) => 'custom-' + (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24)

const emptyForm = () => ({ key: '', name: '', light: { ...DEFAULT_LIGHT }, dark: { ...DEFAULT_DARK } })

export default function ThemePalettesAdmin() {
  const { isSuperAdmin } = usePlatform()
  const [list, setList] = useState([])
  const [form, setForm] = useState(emptyForm())
  const [editingKey, setEditingKey] = useState(null) // null = nova
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    const { data } = await supabase.from('theme_palettes').select('key, name, light, dark').order('created_at')
    setList(data ?? [])
  }
  useEffect(() => { load() }, [])

  const showMsg = (t) => { setMsg(t); setTimeout(() => setMsg(''), 3500) }

  const startNew = () => { setForm(emptyForm()); setEditingKey(null) }
  const startEdit = (p) => {
    setForm({ key: p.key, name: p.name, light: { ...DEFAULT_LIGHT, ...p.light }, dark: { ...DEFAULT_DARK, ...p.dark } })
    setEditingKey(p.key)
  }

  const setColor = (modeKey, token, val) =>
    setForm(f => ({ ...f, [modeKey]: { ...f[modeKey], [token]: val } }))

  const save = async () => {
    if (!form.name.trim()) { showMsg('⚠️ Unesite naziv palete.'); return }
    const key = editingKey || slugify(form.name)
    if (!key || key === 'custom-') { showMsg('⚠️ Naziv mora imati slova/brojeve.'); return }
    setSaving(true)
    const { error } = await supabase.from('theme_palettes')
      .upsert({ key, name: form.name.trim(), light: form.light, dark: form.dark, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    setSaving(false)
    if (error) { showMsg('Greška: ' + error.message); return }
    showMsg('✓ Sačuvano. (Osvježi stranicu da se primijeni svuda.)')
    startNew(); load()
  }

  const remove = async (key) => {
    if (!confirm('Obrisati paletu? Tenanti koji je koriste vraćaju se na zelenu.')) return
    const { error } = await supabase.from('theme_palettes').delete().eq('key', key)
    if (error) { showMsg('Greška: ' + error.message); return }
    if (editingKey === key) startNew()
    load()
  }

  if (!isSuperAdmin()) return <div style={{ padding: 40 }}>Samo superadmin.</div>

  const card = { background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 16 }
  const swatch = (c) => <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 4, background: c, border: '1px solid var(--c-border)', verticalAlign: 'middle' }} />

  return (
    <div style={{ padding: '20px 24px', maxWidth: 880 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, color: 'var(--c-text)' }}>🎨 Custom palete</h1>
      </div>
      <p style={{ color: 'var(--c-text-muted)', fontSize: 13, marginBottom: 20 }}>
        Definiši brend boje (primarna familija + sidebar) za svijetli i tamni mod. Ostatak (tekst,
        pozadine, danger/warning/...) naslijede provjerene default-e. Palete dodjeljuješ tenantima na ovoj
        stranici (uredi tenant → Tema).
      </p>

      {msg && <div style={{ ...card, padding: '10px 14px', marginBottom: 16, color: 'var(--c-text)' }}>{msg}</div>}

      {/* Postojeće palete */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 10, color: 'var(--c-text)' }}>Postojeće palete</div>
        {list.length === 0 ? (
          <div style={{ color: 'var(--c-text-muted)', fontSize: 13 }}>Još nema custom paleta.</div>
        ) : list.map(p => (
          <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--c-border)' }}>
            {swatch(p.light?.primary || '#0d7a52')}{swatch(p.light?.sbBg || '#0d2b1e')}
            <span style={{ fontWeight: 600, color: 'var(--c-text)' }}>{p.name}</span>
            <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{p.key}</span>
            <span style={{ flex: 1 }} />
            <button onClick={() => startEdit(p)} style={{ padding: '4px 10px', fontSize: 12, background: 'var(--c-primary)', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer' }}>Uredi</button>
            <button onClick={() => remove(p.key)} style={{ padding: '4px 10px', fontSize: 12, background: 'transparent', color: 'var(--c-danger)', border: '1px solid var(--c-danger-border)', borderRadius: 7, cursor: 'pointer' }}>Obriši</button>
          </div>
        ))}
      </div>

      {/* Forma */}
      <div style={card}>
        <div style={{ fontWeight: 600, marginBottom: 12, color: 'var(--c-text)' }}>
          {editingKey ? `Uredi: ${form.name}` : 'Nova paleta'}
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>Naziv *</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="npr. Okean" disabled={!!editingKey}
            style={{ width: 280, padding: '8px 10px', border: '1px solid var(--c-border-input)', borderRadius: 8, background: 'var(--c-bg)', color: 'var(--c-text)' }} />
          {editingKey && <span style={{ fontSize: 11, color: 'var(--c-text-muted)', marginLeft: 8 }}>(key: {editingKey})</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px 16px', alignItems: 'center' }}>
          <div />
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-medium)', textAlign: 'center' }}>Svijetla</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-medium)', textAlign: 'center' }}>Tamna</div>
          {TOKENS.map(([token, label]) => (
            <div key={token} style={{ display: 'contents' }}>
              <label style={{ fontSize: 13, color: 'var(--c-text)' }}>{label}</label>
              <input type="color" value={form.light[token]} onChange={e => setColor('light', token, e.target.value)}
                style={{ width: 44, height: 30, border: '1px solid var(--c-border)', borderRadius: 6, background: 'none', cursor: 'pointer' }} />
              <input type="color" value={form.dark[token]} onChange={e => setColor('dark', token, e.target.value)}
                style={{ width: 44, height: 30, border: '1px solid var(--c-border)', borderRadius: 6, background: 'none', cursor: 'pointer' }} />
            </div>
          ))}
        </div>

        {/* Mini preview */}
        <div style={{ display: 'flex', gap: 16, marginTop: 18 }}>
          {['light', 'dark'].map(mk => (
            <div key={mk} style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginBottom: 4 }}>{mk === 'light' ? 'Svijetla' : 'Tamna'}</div>
              <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--c-border)' }}>
                <div style={{ width: 60, background: form[mk].sbBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 0' }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: form[mk].sbAccent }} />
                </div>
                <div style={{ flex: 1, background: mk === 'dark' ? '#141e18' : '#fff', padding: 12 }}>
                  <button style={{ background: form[mk].primary, color: '#fff', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 12 }}>Dugme</button>
                  <span style={{ marginLeft: 8, padding: '4px 10px', borderRadius: 12, fontSize: 12, background: form[mk].primaryLight, color: form[mk].primary }}>badge</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          {editingKey && <button onClick={startNew} style={{ padding: '8px 14px', background: 'transparent', color: 'var(--c-text-medium)', border: '1px solid var(--c-border)', borderRadius: 8, cursor: 'pointer' }}>Nova</button>}
          <button onClick={save} disabled={saving} style={{ padding: '8px 16px', background: 'var(--c-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            {saving ? 'Čuvanje…' : editingKey ? 'Sačuvaj izmjene' : 'Kreiraj paletu'}
          </button>
        </div>
      </div>
    </div>
  )
}
