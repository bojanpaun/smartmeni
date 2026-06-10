import { useState, useEffect } from 'react'
import { usePlatform } from '../../context/PlatformContext'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import styles from '../../modules/hotel/pages/Hotel.module.css'
import { FAQ_CATS } from '../admin/SupportFaq'

const BLANK = { question: '', answer: '', category: 'ostalo', sort_order: 0, is_published: true }

export default function FaqAdmin() {
  const { isSuperAdmin } = usePlatform()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('support_faq').select('*').order('category').order('sort_order')
    setItems(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }
  const reset = () => { setForm(BLANK); setEditingId(null); setShowForm(false) }
  const openNew = () => { setForm(BLANK); setEditingId(null); setShowForm(true) }
  const openEdit = (f) => {
    setEditingId(f.id)
    setForm({ question: f.question, answer: f.answer, category: f.category, sort_order: f.sort_order ?? 0, is_published: f.is_published })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const save = async () => {
    if (!form.question.trim() || !form.answer.trim()) return flash('Pitanje i odgovor su obavezni')
    setSaving(true)
    const payload = {
      question: form.question.trim(), answer: form.answer.trim(),
      category: form.category, sort_order: parseInt(form.sort_order) || 0, is_published: form.is_published,
    }
    let error
    if (editingId) {
      ;({ error } = await supabase.from('support_faq').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId))
    } else {
      ;({ error } = await supabase.from('support_faq').insert({ ...payload, created_by: (await supabase.auth.getUser()).data.user?.id ?? null }))
    }
    setSaving(false)
    if (error) return flash('Greška: ' + error.message)
    reset(); flash(editingId ? 'Sačuvano' : 'Dodato'); load()
  }

  const remove = async (id) => {
    if (!window.confirm('Obrisati pitanje?')) return
    await supabase.from('support_faq').delete().eq('id', id)
    load()
  }

  if (!isSuperAdmin()) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 12, color: 'var(--c-text-muted)' }}>
      <div style={{ fontSize: 40 }}>🔒</div><div>Nemate pristup ovoj stranici.</div>
    </div>
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>📖 Baza znanja (FAQ)</h1>
          <p className={styles.subtitle}>Česta pitanja koja admini vide na stranici Podrška</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {msg && <span style={{ alignSelf: 'center', color: 'var(--c-primary)', fontSize: 13 }}>✓ {msg}</span>}
          {!showForm && <button className={styles.btnPrimary} onClick={openNew}>+ Novo pitanje</button>}
        </div>
      </div>

      {showForm && (
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>{editingId ? '✏️ Izmjena' : 'Novo pitanje'}</div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>Pitanje *</label>
            <input className={styles.input} style={{ width: '100%' }} value={form.question} onChange={e => upd('question', e.target.value)} placeholder="npr. Kako da zatvorim folio?" />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>Odgovor *</label>
            <textarea className={styles.input} style={{ width: '100%', minHeight: 110, resize: 'vertical' }} value={form.answer} onChange={e => upd('answer', e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>Kategorija</label>
              <select className={styles.input} value={form.category} onChange={e => upd('category', e.target.value)}>
                {Object.entries(FAQ_CATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div style={{ width: 110 }}>
              <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>Redoslijed</label>
              <input className={styles.input} type="number" value={form.sort_order} onChange={e => upd('sort_order', e.target.value)} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
              <input type="checkbox" checked={form.is_published} onChange={e => upd('is_published', e.target.checked)} />
              <span style={{ fontSize: 13 }}>Objavljeno</span>
            </label>
            <button className={styles.btnPrimary} onClick={save} disabled={saving}>{saving ? 'Čuvam…' : (editingId ? 'Sačuvaj' : 'Dodaj')}</button>
            <button className={styles.btnSecondary} onClick={reset}>Odustani</button>
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner /> : items.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--c-text-muted)' }}>Još nema pitanja. Dodaj prvo.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(f => (
            <div key={f.id} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '12px 16px', opacity: f.is_published ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{f.question}{!f.is_published && <span style={{ fontSize: 11, color: 'var(--c-text-muted)', fontWeight: 400 }}> (skriveno)</span>}</div>
                  <div style={{ fontSize: 13, color: 'var(--c-text-medium)', marginTop: 4, whiteSpace: 'pre-wrap' }}>{f.answer}</div>
                  <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 6 }}>{FAQ_CATS[f.category] || f.category} · #{f.sort_order}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className={styles.btnSecondary} style={{ fontSize: 12 }} onClick={() => openEdit(f)}>Uredi</button>
                  <button style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', color: 'var(--c-danger)', border: '1px solid var(--c-danger-border)', borderRadius: 7, cursor: 'pointer' }} onClick={() => remove(f.id)}>Obriši</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
