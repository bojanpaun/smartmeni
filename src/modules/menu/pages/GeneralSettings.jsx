import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import { READY_LANGUAGES, DEFAULT_LANG } from '../../../i18n/languages'
import { CURRENCIES, DEFAULT_CURRENCY } from '../../../lib/currencies'
import { translateContent, restaurantDescriptionFields } from '../../../lib/contentTranslate'
import styles from './GeneralSettings.module.css'

export default function GeneralSettings() {
  const { t } = useTranslation('admin')
  const { restaurant, setRestaurant } = usePlatform()
  const [form, setForm]     = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  // Admin jezik (per-tenant default). Mirror na tenants; vozi AdminLangSync (App.jsx)
  // na /admin rutama. Switcher u topbaru je per-sesija override.
  const [lang, setLang] = useState(DEFAULT_LANG)
  const [savedLang, setSavedLang] = useState(DEFAULT_LANG)
  const [langSaving, setLangSaving] = useState(false)
  const [langSaved, setLangSaved] = useState(false)

  // Valuta (per-tenant, FISK-0). Promjena ne konvertuje postojeće cijene — stamp po zapisu.
  const [cur, setCur] = useState(DEFAULT_CURRENCY)
  const [savedCur, setSavedCur] = useState(DEFAULT_CURRENCY)
  const [curSaving, setCurSaving] = useState(false)
  const [curSaved, setCurSaved] = useState(false)

  useEffect(() => {
    if (restaurant) {
      setIsDirty(false)
      setForm({
        name:        restaurant.name        || '',
        location:    restaurant.location    || '',
        phone:       restaurant.phone       || '',
        hours:       restaurant.hours       || '',
        description: restaurant.description || '',
        tax_id:      restaurant.tax_id      || '',
        vat_number:  restaurant.vat_number  || '',
        iban:        restaurant.iban        || '',
      })
    }
  }, [restaurant])

  useEffect(() => {
    const al = restaurant?.admin_language || DEFAULT_LANG
    setLang(al)
    setSavedLang(al)
  }, [restaurant?.admin_language])

  useEffect(() => {
    const c = restaurant?.currency || DEFAULT_CURRENCY
    setCur(c)
    setSavedCur(c)
  }, [restaurant?.currency])

  const curDirty = cur !== savedCur
  const saveCur = async () => {
    if (!restaurant || !curDirty) return
    setCurSaving(true)
    const { error } = await supabase.from('restaurants').update({ currency: cur }).eq('id', restaurant.id)
    setCurSaving(false)
    if (error) return
    setRestaurant({ ...restaurant, currency: cur })
    setSavedCur(cur)
    setCurSaved(true)
    setTimeout(() => setCurSaved(false), 3000)
  }

  const langDirty = lang !== savedLang
  const saveLang = async () => {
    if (!restaurant || !langDirty) return
    setLangSaving(true)
    const { error } = await supabase.from('restaurants').update({ admin_language: lang }).eq('id', restaurant.id)
    setLangSaving(false)
    if (error) return
    // Očisti per-sesija override da novi tenant default odmah zaživi; setRestaurant
    // → AdminLangSync primijeni novi admin_language.
    try { sessionStorage.removeItem('sm_admin_lang') } catch { /* ignore */ }
    setRestaurant({ ...restaurant, admin_language: lang })
    setSavedLang(lang)
    setLangSaved(true)
    setTimeout(() => setLangSaved(false), 3000)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!restaurant || !form) return
    setSaving(true)
    await supabase.from('restaurants').update(form).eq('id', restaurant.id)
    setRestaurant({ ...restaurant, ...form })
    setSaving(false)
    setSaved(true)
    setIsDirty(false)
    setTimeout(() => setSaved(false), 3000)
    // AI prevod opisa objekta (fire-and-forget) — prikazuje se gostu na landingu.
    translateContent(restaurant.id, restaurantDescriptionFields(restaurant.id, form.description)).catch(() => {})
  }

  const setField = (field, val) => { setForm(f => ({ ...f, [field]: val })); setIsDirty(true) }

  if (!form) return <div className={styles.loading}>{t('loading')}</div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('gsTitle')}</h1>
        <p className={styles.subtitle}>{t('gsSubtitle')}</p>
      </div>

      <form onSubmit={save} className={styles.form}>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label>{t('amRestaurantName')}</label>
            <input value={form.name} onChange={e => setField('name', e.target.value)} placeholder={t('gsPhName')} />
          </div>
          <div className={styles.field}>
            <label>{t('amLocation')}</label>
            <input value={form.location} onChange={e => setField('location', e.target.value)} placeholder={t('gsPhLocation')} />
          </div>
          <div className={styles.field}>
            <label>{t('amPhone')}</label>
            <input value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder={t('gsPhPhone')} />
          </div>
          <div className={styles.field}>
            <label>{t('amHours')}</label>
            <input value={form.hours} onChange={e => setField('hours', e.target.value)} placeholder={t('gsPhHours')} />
          </div>
        </div>

        {/* Poslovni podaci prodavca (za fiskalne račune) */}
        <div className={styles.sectionLabel} style={{ marginTop: 4 }}>{t('gsBusinessTitle')}</div>
        <div className={styles.fieldHint} style={{ marginBottom: 12 }}>{t('gsBusinessSub')}</div>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label>{t('gsTaxId')}</label>
            <input value={form.tax_id} onChange={e => setField('tax_id', e.target.value)} placeholder={t('gsTaxIdPh')} />
          </div>
          <div className={styles.field}>
            <label>{t('gsVatNumber')}</label>
            <input value={form.vat_number} onChange={e => setField('vat_number', e.target.value)} placeholder={t('gsVatNumberPh')} />
          </div>
          <div className={styles.field}>
            <label>{t('gsIban')}</label>
            <input value={form.iban} onChange={e => setField('iban', e.target.value)} placeholder={t('gsIbanPh')} />
          </div>
        </div>

        <div className={styles.field} style={{ marginBottom: 20 }}>
          <label>{t('msDescLabel')}</label>
          <textarea
            value={form.description}
            onChange={e => setField('description', e.target.value)}
            placeholder={t('msDescPlaceholder')}
            rows={3}
            className={styles.textarea}
          />
          <div className={styles.fieldHint}>{t('msDescHint')}</div>
        </div>
        <div className={styles.formActions}>
          {saved && !isDirty && <span className={styles.savedMsg}>✓ {t('saved')}</span>}
          {(isDirty || saving) && (
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? t('saving') : t('amSaveChanges')}
            </button>
          )}
        </div>
      </form>

      {/* ── Jezik admin panela (per-tenant default) ── */}
      <div className={styles.sectionLabel} style={{ marginTop: 28 }}>{t('thLangTitle')}</div>
      <div className={styles.visDesc}>{t('thLangSubtitle')}</div>
      <div className={styles.formActions} style={{ justifyContent: 'flex-start', gap: 12 }}>
        <select
          value={lang}
          onChange={e => setLang(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--c-border)',
            background: 'var(--c-surface)', color: 'var(--c-text)', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}
        >
          {READY_LANGUAGES.map(l => (
            <option key={l.code} value={l.code}>{l.native}</option>
          ))}
        </select>
        {langSaved && !langDirty && <span className={styles.savedMsg}>✓ {t('saved')}</span>}
        {langDirty && (
          <button className={styles.saveBtn} onClick={saveLang} disabled={langSaving}>
            {langSaving ? t('saving') : t('thSaveLang')}
          </button>
        )}
      </div>

      {/* ── Valuta (per-tenant, FISK-0) ── */}
      <div className={styles.sectionLabel} style={{ marginTop: 28 }}>{t('gsCurrencyTitle')}</div>
      <div className={styles.visDesc}>{t('gsCurrencySub')}</div>
      <div className={styles.formActions} style={{ justifyContent: 'flex-start', gap: 12 }}>
        <select
          value={cur}
          onChange={e => setCur(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--c-border)',
            background: 'var(--c-surface)', color: 'var(--c-text)', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}
        >
          {CURRENCIES.map(c => (
            <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
          ))}
        </select>
        {curSaved && !curDirty && <span className={styles.savedMsg}>✓ {t('saved')}</span>}
        {curDirty && (
          <button className={styles.saveBtn} onClick={saveCur} disabled={curSaving}>
            {curSaving ? t('saving') : t('gsSaveCurrency')}
          </button>
        )}
      </div>
    </div>
  )
}
