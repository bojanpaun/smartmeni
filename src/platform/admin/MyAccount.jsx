// ▶ Novi fajl: src/platform/admin/MyAccount.jsx

import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'
import styles from './MyAccount.module.css'

export default function MyAccount() {
  const { user } = usePlatform()
  const { t } = useTranslation('admin')

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    whatsapp: '',
    viber: '',
  })

  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new: '',
    confirm: '',
  })

  const avatarRef = useRef()

  useEffect(() => {
    if (user) loadProfile()
  }, [user])

  const loadProfile = async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) {
      setProfile(data)
      setForm({
        full_name: data.full_name || '',
        phone: data.phone || '',
        whatsapp: data.whatsapp || '',
        viber: data.viber || '',
      })
    }
    setLoading(false)
  }

  const showMsg = (type, text) => {
    setMsg({ type, text })
    setTimeout(() => setMsg({ type: '', text: '' }), 4000)
  }

  // ── Čuvanje profila ───────────────────────────────────────
  const saveProfile = async (e) => {
    e.preventDefault()
    if (!form.phone.trim()) {
      showMsg('error', t('accPhoneReq'))
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('user_profiles')
      .update({
        full_name: form.full_name || null,
        phone: form.phone,
        whatsapp: form.whatsapp || null,
        viber: form.viber || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (error) {
      showMsg('error', t('accSaveErr'))
    } else {
      showMsg('success', t('accSaved'))
      setProfile(p => ({ ...p, ...form }))
    }
    setSaving(false)
  }

  // ── Promjena lozinke ──────────────────────────────────────
  const changePassword = async (e) => {
    e.preventDefault()
    if (passwordForm.new.length < 6) {
      showMsg('error', t('accPwMin'))
      return
    }
    if (passwordForm.new !== passwordForm.confirm) {
      showMsg('error', t('accPwMismatch'))
      return
    }
    setSavingPassword(true)

    const { error } = await supabase.auth.updateUser({
      password: passwordForm.new,
    })

    if (error) {
      showMsg('error', t('accPwChangeErr') + error.message)
    } else {
      showMsg('success', t('accPwChanged'))
      setPasswordForm({ current: '', new: '', confirm: '' })
    }
    setSavingPassword(false)
  }

  // ── Upload avatara ────────────────────────────────────────
  const uploadAvatar = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      showMsg('error', t('accImgTooBig'))
      return
    }

    setUploadingAvatar(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      showMsg('error', t('accImgUploadErr'))
      setUploadingAvatar(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(path)

    const url = publicUrl + '?t=' + Date.now()

    await supabase.from('user_profiles').update({ avatar_url: url }).eq('id', user.id)
    setProfile(p => ({ ...p, avatar_url: url }))
    showMsg('success', t('accAvatarUpdated'))
    setUploadingAvatar(false)
  }

  if (loading) return <div className={styles.loading}>{t('loading')}</div>

  const initials = form.full_name
    ? form.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0] || '?').toUpperCase()

  return (
    <div className={styles.wrap}>

      <div className={styles.header}>
        <div className={styles.headerTitle}>{t('accTitle')}</div>
        <div className={styles.headerEmail}>{user?.email}</div>
      </div>

      {msg.text && (
        <div className={`${styles.msg} ${msg.type === 'error' ? styles.msgError : styles.msgSuccess}`}>
          {msg.type === 'error' ? '⚠️' : '✓'} {msg.text}
        </div>
      )}

      <div className={styles.layout}>

        {/* Lijevo — avatar */}
        <div className={styles.avatarSection}>
          <div className={styles.avatarWrap}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className={styles.avatarImg} />
            ) : (
              <div className={styles.avatarPlaceholder}>{initials}</div>
            )}
            {uploadingAvatar && <div className={styles.avatarOverlay}>⏳</div>}
          </div>

          <input
            type="file"
            ref={avatarRef}
            accept="image/jpeg,image/png,image/webp"
            className={styles.avatarInput}
            onChange={uploadAvatar}
          />
          <button
            className={styles.avatarBtn}
            onClick={() => avatarRef.current.click()}
            disabled={uploadingAvatar}
          >
            {uploadingAvatar ? t('accUploading') : t('accChangeImg')}
          </button>
          <div className={styles.avatarHint}>{t('accAvatarHint')}</div>
        </div>

        {/* Desno — forme */}
        <div className={styles.forms}>

          {/* Lični podaci */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>{t('accPersonalData')}</div>
            <form onSubmit={saveProfile} className={styles.form}>
              <div className={styles.field}>
                <label>{t('accFullName')}</label>
                <input
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder={t('accFullNamePh')}
                />
              </div>

              <div className={styles.field}>
                <label>{t('accPhone')}</label>
                <input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+382 XX XXX XXX"
                  required
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>{t('accWhatsapp')}</label>
                  <div className={styles.inputWithIcon}>
                    <span className={styles.inputIcon}>💬</span>
                    <input
                      value={form.whatsapp}
                      onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                      placeholder="+382 XX XXX XXX"
                    />
                  </div>
                </div>
                <div className={styles.field}>
                  <label>{t('accViber')}</label>
                  <div className={styles.inputWithIcon}>
                    <span className={styles.inputIcon}>📱</span>
                    <input
                      value={form.viber}
                      onChange={e => setForm(f => ({ ...f, viber: e.target.value }))}
                      placeholder="+382 XX XXX XXX"
                    />
                  </div>
                </div>
              </div>

              <div className={styles.formActions}>
                <button type="submit" className={styles.btnSave} disabled={saving}>
                  {saving ? t('saving') : t('accSaveData')}
                </button>
              </div>
            </form>
          </div>

          {/* Promjena lozinke */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>{t('accChangePw')}</div>
            <form onSubmit={changePassword} className={styles.form}>
              <div className={styles.field}>
                <label>{t('accNewPw')}</label>
                <input
                  type="password"
                  value={passwordForm.new}
                  onChange={e => setPasswordForm(f => ({ ...f, new: e.target.value }))}
                  placeholder={t('accNewPwPh')}
                  required
                />
              </div>
              <div className={styles.field}>
                <label>{t('accConfirmPw')}</label>
                <input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={e => setPasswordForm(f => ({ ...f, confirm: e.target.value }))}
                  placeholder={t('accConfirmPwPh')}
                  required
                />
              </div>
              {passwordForm.new && passwordForm.confirm && passwordForm.new !== passwordForm.confirm && (
                <div className={styles.fieldError}>{t('accPwNoMatch')}</div>
              )}
              <div className={styles.formActions}>
                <button
                  type="submit"
                  className={styles.btnSave}
                  disabled={savingPassword || !passwordForm.new || !passwordForm.confirm}
                >
                  {savingPassword ? t('accChanging') : t('accChangePwBtn')}
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  )
}
