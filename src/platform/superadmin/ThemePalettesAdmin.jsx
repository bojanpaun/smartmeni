import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'
import { deriveShades } from '../../lib/brandPalette'

// Editor custom paleta (superadmin). Bira 7 brend tokena za light i dark;
// ostali tokeni naslijede bazni green / green-dark. Vidi useTheme.js + migraciju
// 20260610120000_theme_palettes.sql.

const TOKENS = [
  ['primary',       'tpTokPrimary'],
  ['primaryHover',  'tpTokPrimaryHover'],
  ['primaryMedium', 'tpTokPrimaryMedium'],
  ['primaryLight',  'tpTokPrimaryLight'],
  ['primaryMuted',  'tpTokPrimaryMuted'],
  ['sbBg',          'tpTokSbBg'],
  ['sbAccent',      'tpTokSbAccent'],
]

const DEFAULT_LIGHT = { primary: '#0d7a52', primaryHover: '#0a6343', primaryMedium: '#1d9e75', primaryLight: '#e0f5ec', primaryMuted: '#9ad4be', sbBg: '#0d2b1e', sbAccent: '#5dcaa5' }
const DEFAULT_DARK  = { primary: '#1d9e75', primaryHover: '#25b882', primaryMedium: '#5dcaa5', primaryLight: '#173d30', primaryMuted: '#2d6b55', sbBg: '#081a10', sbAccent: '#5dcaa5' }

// Ugrađene palete (CSS blokovi u index.css). Prikazane su u listi i mogu se urediti:
// izmjena snima override red u theme_palettes sa istim key-em koji useTheme primijeni
// inline preko CSS bloka. "Vrati podrazumijevano" briše taj red. Vrijednosti su izvor
// istine iz index.css ([data-theme="blue"], "purple", *-dark). Dark primaryLight su
// hex aproksimacije rgba(...,0.15) tokena (color input ne podržava alfu).
const BUILTIN_PALETTES = [
  {
    key: 'green', name: 'Zelena', nameKey: 'tpPalGreen',
    light: { ...DEFAULT_LIGHT },
    dark:  { ...DEFAULT_DARK },
  },
  {
    key: 'blue', name: 'Plava', nameKey: 'tpPalBlue',
    light: { primary: '#2563eb', primaryHover: '#1d4ed8', primaryMedium: '#3b82f6', primaryLight: '#eff6ff', primaryMuted: '#93c5fd', sbBg: '#0c1938', sbAccent: '#60a5fa' },
    dark:  { primary: '#60a5fa', primaryHover: '#93c5fd', primaryMedium: '#3b82f6', primaryLight: '#14233f', primaryMuted: '#1e3a6e', sbBg: '#070f22', sbAccent: '#60a5fa' },
  },
  {
    key: 'purple', name: 'Ljubičasta', nameKey: 'tpPalPurple',
    light: { primary: '#7c3aed', primaryHover: '#6d28d9', primaryMedium: '#8b5cf6', primaryLight: '#f3effe', primaryMuted: '#c4b5fd', sbBg: '#1e1340', sbAccent: '#a78bfa' },
    dark:  { primary: '#a78bfa', primaryHover: '#c4b5fd', primaryMedium: '#8b5cf6', primaryLight: '#221645', primaryMuted: '#4c2d8f', sbBg: '#160d30', sbAccent: '#a78bfa' },
  },
]
const BUILTIN_KEYS = BUILTIN_PALETTES.map(p => p.key)

const slugify = (s) => 'custom-' + (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24)

const emptyForm = () => ({ key: '', name: '', light: { ...DEFAULT_LIGHT }, dark: { ...DEFAULT_DARK } })

export default function ThemePalettesAdmin() {
  const { isSuperAdmin } = usePlatform()
  const { t } = useTranslation('admin')
  const [list, setList] = useState([])
  const [form, setForm] = useState(emptyForm())
  const [editingKey, setEditingKey] = useState(null) // null = nova
  const [baseColor, setBaseColor] = useState(DEFAULT_LIGHT.primary) // osnovna boja za auto-nijansiranje
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    const { data } = await supabase.from('theme_palettes').select('key, name, light, dark').order('created_at')
    setList(data ?? [])
  }
  useEffect(() => { load() }, [])

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500) }

  const startNew = () => { setForm(emptyForm()); setEditingKey(null); setBaseColor(DEFAULT_LIGHT.primary) }
  const startEdit = (p) => {
    setForm({ key: p.key, name: p.name, light: { ...DEFAULT_LIGHT, ...p.light }, dark: { ...DEFAULT_DARK, ...p.dark } })
    setEditingKey(p.key)
    setBaseColor(p.light?.primary || DEFAULT_LIGHT.primary)
  }

  // Popuni svih 14 tokena (light+dark) nijansama izvedenim iz osnovne boje.
  // Ručne izmjene se ne diraju dok superadmin ponovo ne klikne.
  const generateFromBase = () => {
    const sh = deriveShades(baseColor)
    setForm(f => ({ ...f, light: sh.light, dark: sh.dark }))
    showMsg(t('tpGenerated'))
  }

  const setColor = (modeKey, token, val) =>
    setForm(f => ({ ...f, [modeKey]: { ...f[modeKey], [token]: val } }))

  const save = async () => {
    if (!form.name.trim()) { showMsg(t('tpNameReq')); return }
    const key = editingKey || slugify(form.name)
    if (!key || key === 'custom-') { showMsg(t('tpNameLettersReq')); return }
    setSaving(true)
    const { error } = await supabase.from('theme_palettes')
      .upsert({ key, name: form.name.trim(), light: form.light, dark: form.dark, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    setSaving(false)
    if (error) { showMsg(t('saErrPrefix') + error.message); return }
    showMsg(t('tpSaved'))
    startNew(); load()
  }

  const remove = async (key) => {
    if (!confirm(t('tpDeleteConfirm'))) return
    const { error } = await supabase.from('theme_palettes').delete().eq('key', key)
    if (error) { showMsg(t('saErrPrefix') + error.message); return }
    if (editingKey === key) startNew()
    load()
  }

  // "Vrati podrazumijevano" za ugrađenu paletu = obriši override red (CSS blok ostaje).
  const resetBuiltin = async (key) => {
    if (!confirm(t('tpResetConfirm'))) return
    const { error } = await supabase.from('theme_palettes').delete().eq('key', key)
    if (error) { showMsg(t('saErrPrefix') + error.message); return }
    if (editingKey === key) startNew()
    showMsg(t('tpReset'))
    load()
  }

  if (!isSuperAdmin()) return <div style={{ padding: 40 }}>{t('tpOnlySuper')}</div>

  // Override redovi za ugrađene palete + čisto custom palete.
  const overrideMap = Object.fromEntries(list.filter(p => BUILTIN_KEYS.includes(p.key)).map(p => [p.key, p]))
  const customList = list.filter(p => !BUILTIN_KEYS.includes(p.key))
  // Prikazane boje ugrađene palete = override ako postoji, inače ugrađeni default.
  const builtinRows = BUILTIN_PALETTES.map(b => {
    const ov = overrideMap[b.key]
    return {
      ...b,
      modified: !!ov,
      displayLight: { ...b.light, ...(ov?.light || {}) },
      editLight: { ...DEFAULT_LIGHT, ...b.light, ...(ov?.light || {}) },
      editDark:  { ...DEFAULT_DARK,  ...b.dark,  ...(ov?.dark  || {}) },
    }
  })

  const card = { background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 16 }
  const swatch = (c) => <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 4, background: c, border: '1px solid var(--c-border)', verticalAlign: 'middle' }} />

  return (
    <div style={{ padding: '20px 24px', maxWidth: 880 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--c-font-display)', color: 'var(--c-text)' }}>🎨 {t('tpTitle')}</h1>
      </div>
      <p style={{ color: 'var(--c-text-muted)', fontSize: 13, marginBottom: 20 }}>
        {t('tpDesc')}
      </p>

      {msg && <div style={{ ...card, padding: '10px 14px', marginBottom: 16, color: 'var(--c-text)' }}>{msg}</div>}

      {/* Postojeće palete */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 10, color: 'var(--c-text)' }}>{t('tpExisting')}</div>

        {/* Ugrađene palete — uvijek dostupne, mogu se urediti ili vratiti na default. */}
        {builtinRows.map(b => (
          <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--c-border)' }}>
            {swatch(b.displayLight.primary)}{swatch(b.displayLight.sbBg)}
            <span style={{ fontWeight: 600, color: 'var(--c-text)' }}>{t(b.nameKey)}</span>
            <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{b.key}</span>
            <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: 'var(--c-primary-light)', color: 'var(--c-primary)' }}>
              {b.modified ? t('tpModified') : t('tpBuiltin')}
            </span>
            <span style={{ flex: 1 }} />
            <button onClick={() => startEdit({ key: b.key, name: t(b.nameKey), light: b.editLight, dark: b.editDark })} style={{ padding: '4px 10px', fontSize: 12, background: 'var(--c-primary)', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer' }}>{t('htEdit')}</button>
            {b.modified && (
              <button onClick={() => resetBuiltin(b.key)} style={{ padding: '4px 10px', fontSize: 12, background: 'transparent', color: 'var(--c-text-medium)', border: '1px solid var(--c-border)', borderRadius: 7, cursor: 'pointer' }}>{t('tpResetDefault')}</button>
            )}
          </div>
        ))}

        {/* Custom palete */}
        {customList.length === 0 ? (
          <div style={{ color: 'var(--c-text-muted)', fontSize: 13, paddingTop: 10 }}>{t('tpNoCustom')}</div>
        ) : customList.map(p => (
          <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--c-border)' }}>
            {swatch(p.light?.primary || '#0d7a52')}{swatch(p.light?.sbBg || '#0d2b1e')}
            <span style={{ fontWeight: 600, color: 'var(--c-text)' }}>{p.name}</span>
            <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{p.key}</span>
            <span style={{ flex: 1 }} />
            <button onClick={() => startEdit(p)} style={{ padding: '4px 10px', fontSize: 12, background: 'var(--c-primary)', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer' }}>{t('htEdit')}</button>
            <button onClick={() => remove(p.key)} style={{ padding: '4px 10px', fontSize: 12, background: 'transparent', color: 'var(--c-danger)', border: '1px solid var(--c-danger-border)', borderRadius: 7, cursor: 'pointer' }}>{t('htDelete')}</button>
          </div>
        ))}
      </div>

      {/* Forma */}
      <div style={card}>
        <div style={{ fontWeight: 600, marginBottom: 12, color: 'var(--c-text)' }}>
          {editingKey ? t('saEditName', { name: form.name }) : t('tpNewPalette')}
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>{t('tpNameLabel')}</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder={t('tpNamePh')} disabled={!!editingKey}
            style={{ width: 280, padding: '8px 10px', border: '1px solid var(--c-border-input)', borderRadius: 8, background: 'var(--c-bg)', color: 'var(--c-text)' }} />
          {editingKey && <span style={{ fontSize: 11, color: 'var(--c-text-muted)', marginLeft: 8 }}>{t('tpKeyLabel', { key: editingKey })}</span>}
        </div>

        {/* Osnovna boja → auto-nijansiranje svih tokena */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 16, padding: '12px 14px', background: 'var(--c-bg)', border: '1px dashed var(--c-border)', borderRadius: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>{t('tpBaseColor')}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="color" value={baseColor} onChange={e => setBaseColor(e.target.value)}
                style={{ width: 44, height: 32, border: '1px solid var(--c-border)', borderRadius: 6, background: 'none', cursor: 'pointer' }} />
              <input value={baseColor} onChange={e => setBaseColor(e.target.value)}
                style={{ width: 96, padding: '7px 9px', border: '1px solid var(--c-border-input)', borderRadius: 8, background: 'var(--c-surface)', color: 'var(--c-text)', fontSize: 13 }} />
            </div>
          </div>
          <button type="button" onClick={generateFromBase}
            style={{ padding: '8px 14px', background: 'var(--c-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            {t('tpGenerateShades')}
          </button>
          <span style={{ fontSize: 12, color: 'var(--c-text-muted)', flex: 1 }}>
            {t('tpGenerateHint')}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px 16px', alignItems: 'center' }}>
          <div />
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-medium)', textAlign: 'center' }}>{t('tpLight')}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-medium)', textAlign: 'center' }}>{t('tpDark')}</div>
          {TOKENS.map(([token, labelKey]) => (
            <div key={token} style={{ display: 'contents' }}>
              <label style={{ fontSize: 13, color: 'var(--c-text)' }}>{t(labelKey)}</label>
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
              <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginBottom: 4 }}>{mk === 'light' ? t('tpLight') : t('tpDark')}</div>
              <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--c-border)' }}>
                <div style={{ width: 60, background: form[mk].sbBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 0' }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: form[mk].sbAccent }} />
                </div>
                <div style={{ flex: 1, background: mk === 'dark' ? '#141e18' : '#fff', padding: 12 }}>
                  <button style={{ background: form[mk].primary, color: '#fff', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 12 }}>{t('tpButton')}</button>
                  <span style={{ marginLeft: 8, padding: '4px 10px', borderRadius: 12, fontSize: 12, background: form[mk].primaryLight, color: form[mk].primary }}>badge</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          {editingKey && <button onClick={startNew} style={{ padding: '8px 14px', background: 'transparent', color: 'var(--c-text-medium)', border: '1px solid var(--c-border)', borderRadius: 8, cursor: 'pointer' }}>{t('tpNew')}</button>}
          <button onClick={save} disabled={saving} style={{ padding: '8px 16px', background: 'var(--c-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            {saving ? t('saving') : editingKey ? t('spaSaveChanges') : t('tpCreatePalette')}
          </button>
        </div>
      </div>
    </div>
  )
}
