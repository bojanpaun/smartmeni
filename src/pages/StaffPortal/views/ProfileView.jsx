import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import s from '../StaffPortal.module.css'

// Sva obavještenja (oglasna tabla) — pregled u tabu Profil
function StaffNotifications({ restaurantId }) {
  const [items, setItems] = useState([])
  useEffect(() => {
    if (!restaurantId) return
    supabase.from('staff_announcements').select('*')
      .eq('restaurant_id', restaurantId).order('created_at', { ascending: false })
      .then(({ data }) => setItems(data ?? []))
  }, [restaurantId])
  return (
    <div className={s.card}>
      <div className={s.cardTitle}>Obavještenja ({items.length})</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--c-text-muted)', padding: '6px 0' }}>Nema obavijesti.</div>
      ) : items.map(a => {
        const expired = a.expires_at && new Date(a.expires_at) < new Date()
        return (
          <div key={a.id} style={{ padding: '10px 0', borderTop: '1px solid var(--c-border)', opacity: expired ? 0.55 : 1 }}>
            <div style={{ fontWeight: 600 }}>📢 {a.title}{expired && <span style={{ fontSize: 11, color: 'var(--c-text-muted)', fontWeight: 400 }}> (isteklo)</span>}</div>
            {a.body && <div style={{ fontSize: 13, color: 'var(--c-text-medium)', marginTop: 3, whiteSpace: 'pre-wrap' }}>{a.body}</div>}
            <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 5 }}>
              {new Date(a.created_at).toLocaleDateString('sr-Latn', { day: 'numeric', month: 'long' })}
              {a.edited_at && ' · izmijenjeno'}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function ProfileView({ staff, staffId, brand }) {
  const [form, setForm] = useState({
    phone:                  staff?.phone                  || '',
    address:                staff?.address                || '',
    emergency_contact_name: staff?.emergency_contact_name || '',
    emergency_contact_phone:staff?.emergency_contact_phone|| '',
  })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  const [pw, setPw]         = useState({ new: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError,  setPwError]  = useState('')
  const [pwDone,   setPwDone]   = useState(false)

  const saveContact = async (e) => {
    e.preventDefault()
    setSaving(true)
    await supabase.from('staff').update({
      phone:                  form.phone                   || null,
      address:                form.address                 || null,
      emergency_contact_name: form.emergency_contact_name  || null,
      emergency_contact_phone:form.emergency_contact_phone || null,
    }).eq('id', staffId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const changePassword = async (e) => {
    e.preventDefault()
    setPwError('')
    if (pw.new !== pw.confirm) { setPwError('Lozinke se ne poklapaju.'); return }
    if (pw.new.length < 6)    { setPwError('Lozinka mora imati najmanje 6 karaktera.'); return }
    setPwSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pw.new })
    setPwSaving(false)
    if (error) { setPwError(error.message); return }
    setPwDone(true)
    setPw({ new: '', confirm: '' })
  }

  const displayName = [staff?.first_name, staff?.last_name].filter(Boolean).join(' ') || staff?.email || ''
  const initial     = displayName[0]?.toUpperCase() || '?'
  const roleName    = staff?.role?.name || 'Osoblje'

  return (
    <div>
      {/* Osnovno */}
      <div className={s.card}>
        <div className={s.cardTitle}>Moj profil</div>
        <div className={s.profileRow}>
          <div className={s.profileAvatar} style={{ background: brand }}>{initial}</div>
          <div className={s.profileInfo}>
            <div className={s.profileName}>{displayName}</div>
            <div className={s.profileRole}>{roleName}</div>
            <div className={s.profileEmail}>{staff?.email}</div>
          </div>
        </div>
        {staff?.start_date && (
          <div className={s.profileMeta}>
            Zaposlen/a od {new Date(staff.start_date).toLocaleDateString('sr-Latn', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        )}
      </div>

      <StaffNotifications restaurantId={staff?.restaurant_id} />

      {/* Kontakt i hitni kontakt */}
      <div className={s.card}>
        <div className={s.cardTitle}>Kontakt podaci</div>
        <form onSubmit={saveContact}>
          <div className={s.absenceFormField}>
            <label>Telefon</label>
            <input type="tel" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+382 67 000 000" />
          </div>
          <div className={s.absenceFormField}>
            <label>Adresa</label>
            <input value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="Ulica i broj, grad" />
          </div>
          <div className={s.profileSectionLabel}>U slučaju nužde</div>
          <div className={s.absenceFormRow}>
            <div className={s.absenceFormField}>
              <label>Ime kontakta</label>
              <input value={form.emergency_contact_name}
                onChange={e => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))}
                placeholder="Ime i prezime" />
            </div>
            <div className={s.absenceFormField}>
              <label>Telefon</label>
              <input type="tel" value={form.emergency_contact_phone}
                onChange={e => setForm(f => ({ ...f, emergency_contact_phone: e.target.value }))}
                placeholder="+382 ..." />
            </div>
          </div>
          {saved && <div className={s.profileSaved}>✓ Sačuvano</div>}
          <button type="submit" className={s.profileSaveBtn} style={{ background: brand }} disabled={saving}>
            {saving ? 'Čuvanje...' : 'Sačuvaj promjene'}
          </button>
        </form>
      </div>

      {/* Promjena lozinke */}
      <div className={s.card}>
        <div className={s.cardTitle}>Promjena lozinke</div>
        {pwDone ? (
          <div className={s.profileSaved}>✓ Lozinka je uspješno promijenjena.</div>
        ) : (
          <form onSubmit={changePassword}>
            <div className={s.absenceFormField}>
              <label>Nova lozinka</label>
              <input type="password" value={pw.new}
                onChange={e => setPw(p => ({ ...p, new: e.target.value }))}
                placeholder="najmanje 6 karaktera" required minLength={6} autoComplete="new-password" />
            </div>
            <div className={s.absenceFormField}>
              <label>Potvrdi novu lozinku</label>
              <input type="password" value={pw.confirm}
                onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
                placeholder="ponovi lozinku" required autoComplete="new-password" />
            </div>
            {pwError && <div className={s.profilePwError}>{pwError}</div>}
            <button type="submit" className={s.profileSaveBtn} style={{ background: brand }} disabled={pwSaving}>
              {pwSaving ? 'Promjena...' : 'Promijeni lozinku'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
