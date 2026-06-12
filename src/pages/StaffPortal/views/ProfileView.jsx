import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import s from '../StaffPortal.module.css'

export default function ProfileView({ staff, staffId, brand }) {
  const { t } = useTranslation('staffportal')
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
    if (pw.new !== pw.confirm) { setPwError(t('errPasswordMismatch')); return }
    if (pw.new.length < 6)    { setPwError(t('errPasswordShort')); return }
    setPwSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pw.new })
    setPwSaving(false)
    if (error) { setPwError(error.message); return }
    setPwDone(true)
    setPw({ new: '', confirm: '' })
  }

  const displayName = [staff?.first_name, staff?.last_name].filter(Boolean).join(' ') || staff?.email || ''
  const initial     = displayName[0]?.toUpperCase() || '?'
  const roleName    = staff?.role?.name || t('roleFallback')

  return (
    <div>
      {/* Osnovno */}
      <div className={s.card}>
        <div className={s.cardTitle}>{t('myProfile')}</div>
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
            {t('employedSince', { date: new Date(staff.start_date).toLocaleDateString('sr-Latn', { day: 'numeric', month: 'long', year: 'numeric' }) })}
          </div>
        )}
      </div>

      {/* Kontakt i hitni kontakt */}
      <div className={s.card}>
        <div className={s.cardTitle}>{t('contactInfo')}</div>
        <form onSubmit={saveContact}>
          <div className={s.absenceFormField}>
            <label>{t('phone')}</label>
            <input type="tel" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+382 67 000 000" />
          </div>
          <div className={s.absenceFormField}>
            <label>{t('address')}</label>
            <input value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder={t('phAddress')} />
          </div>
          <div className={s.profileSectionLabel}>{t('emergencySection')}</div>
          <div className={s.absenceFormRow}>
            <div className={s.absenceFormField}>
              <label>{t('contactName')}</label>
              <input value={form.emergency_contact_name}
                onChange={e => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))}
                placeholder={t('phFullName')} />
            </div>
            <div className={s.absenceFormField}>
              <label>{t('phone')}</label>
              <input type="tel" value={form.emergency_contact_phone}
                onChange={e => setForm(f => ({ ...f, emergency_contact_phone: e.target.value }))}
                placeholder="+382 ..." />
            </div>
          </div>
          {saved && <div className={s.profileSaved}>✓ {t('saved')}</div>}
          <button type="submit" className={s.profileSaveBtn} style={{ background: brand }} disabled={saving}>
            {saving ? t('saving') : t('saveChanges')}
          </button>
        </form>
      </div>

      {/* Promjena lozinke */}
      <div className={s.card}>
        <div className={s.cardTitle}>{t('changePassword')}</div>
        {pwDone ? (
          <div className={s.profileSaved}>✓ {t('passwordChanged')}</div>
        ) : (
          <form onSubmit={changePassword}>
            <div className={s.absenceFormField}>
              <label>{t('newPassword')}</label>
              <input type="password" value={pw.new}
                onChange={e => setPw(p => ({ ...p, new: e.target.value }))}
                placeholder={t('phMin6')} required minLength={6} autoComplete="new-password" />
            </div>
            <div className={s.absenceFormField}>
              <label>{t('confirmNewPassword')}</label>
              <input type="password" value={pw.confirm}
                onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
                placeholder={t('phRepeatPassword')} required autoComplete="new-password" />
            </div>
            {pwError && <div className={s.profilePwError}>{pwError}</div>}
            <button type="submit" className={s.profileSaveBtn} style={{ background: brand }} disabled={pwSaving}>
              {pwSaving ? t('changing') : t('changePasswordBtn')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
