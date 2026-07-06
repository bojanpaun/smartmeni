import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import { logAudit } from '../../../lib/auditLog'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import styles from './SettingsPage.module.css'

const empty = {
  tourist_tax_per_person: '', tourist_tax_currency: 'EUR', tourist_tax_child_age_exempt: '',
  eturista_facility_id: '', fiscal_enabled: true, default_check_in_instructions: '',
  payment_type: 'on_arrival', deposit_pct: 30,
}

export default function RentalSettingsPage() {
  const { restaurant } = usePlatform()
  const { t } = useTranslation('admin')
  const navigate = useNavigate()
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!restaurant?.id) return
    supabase.from('rental_settings')
      .select('tourist_tax_per_person, tourist_tax_currency, tourist_tax_child_age_exempt, eturista_facility_id, fiscal_enabled, default_check_in_instructions, payment_type, deposit_pct')
      .eq('restaurant_id', restaurant.id).maybeSingle()
      .then(({ data }) => {
        if (data) setForm({
          tourist_tax_per_person: data.tourist_tax_per_person ?? '',
          tourist_tax_currency: data.tourist_tax_currency || 'EUR',
          tourist_tax_child_age_exempt: data.tourist_tax_child_age_exempt ?? '',
          eturista_facility_id: data.eturista_facility_id ?? '',
          fiscal_enabled: data.fiscal_enabled ?? true,
          default_check_in_instructions: data.default_check_in_instructions ?? '',
          payment_type: data.payment_type || 'on_arrival',
          deposit_pct: data.deposit_pct ?? 30,
        })
        setLoading(false)
      })
  }, [restaurant?.id])

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase.from('rental_settings').upsert({
      restaurant_id: restaurant.id,
      tourist_tax_per_person: parseFloat(form.tourist_tax_per_person) || 0,
      tourist_tax_currency: form.tourist_tax_currency || 'EUR',
      tourist_tax_child_age_exempt: form.tourist_tax_child_age_exempt === '' ? null : parseInt(form.tourist_tax_child_age_exempt),
      eturista_facility_id: form.eturista_facility_id.trim() || null,
      fiscal_enabled: form.fiscal_enabled,
      default_check_in_instructions: form.default_check_in_instructions.trim() || null,
      payment_type: form.payment_type === 'online' ? 'online' : 'on_arrival',
      deposit_pct: Math.min(100, Math.max(1, parseFloat(form.deposit_pct) || 30)),
    }, { onConflict: 'restaurant_id' })
    setSaving(false)
    if (error) return toast.error(t('rsSaveErr'))
    toast.success(t('rsSaved'))
    // Audit (CLAUDE.md §10) — smislena postavka (politika plaćanja/taksa). Fire-and-forget.
    logAudit({
      restaurantId: restaurant.id, action: 'rental.settings_update', entityType: 'rental_settings',
      entityId: restaurant.id, summary: t('rsTitle'),
      metadata: { payment_type: form.payment_type, deposit_pct: form.payment_type === 'online' ? form.deposit_pct : null },
    })
  }

  if (loading) return <LoadingSpinner fullPage />

  return (
    <div className={styles.wrap}>
      <button className={styles.btnBack} onClick={() => navigate('/admin/rental')}>← {t('modRental')}</button>
      <h1 className={styles.title}>{t('rsTitle')}</h1>
      <p className={styles.subtitle}>{t('rsSubtitle')}</p>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>{t('rsPaySection')}</h2>
        <div className={styles.grid}>
          <label className={styles.field}>{t('rsPayPolicy')}
            <select className={styles.input} value={form.payment_type} onChange={e => set('payment_type', e.target.value)}>
              <option value="on_arrival">{t('rsPayOnArrival')}</option>
              <option value="online">{t('rsPayOnline')}</option>
            </select>
          </label>
          {form.payment_type === 'online' && (
            <label className={styles.field}>{t('rsDepositPct')}
              <input className={styles.input} type="number" min={1} max={100} step="1" value={form.deposit_pct}
                onChange={e => set('deposit_pct', e.target.value)} />
              <span className={styles.hint}>{t('rsDepositPctHint')}</span>
            </label>
          )}
        </div>
        <p className={styles.hint}>{form.payment_type === 'online' ? t('rsPayOnlineHint') : t('rsPayOnArrivalHint')}</p>
      </div>

      <div className={styles.card}>
        <div className={styles.grid}>
          <label className={styles.field}>{t('rsTaxPerPerson')}
            <input className={styles.input} type="number" min={0} step="0.01" value={form.tourist_tax_per_person}
              onChange={e => set('tourist_tax_per_person', e.target.value)} placeholder="1.00" />
          </label>
          <label className={styles.field}>{t('rsTaxCurrency')}
            <input className={styles.input} value={form.tourist_tax_currency} maxLength={3}
              onChange={e => set('tourist_tax_currency', e.target.value.toUpperCase())} />
          </label>
          <label className={styles.field}>{t('rsChildExempt')}
            <input className={styles.input} type="number" min={0} max={18} value={form.tourist_tax_child_age_exempt}
              onChange={e => set('tourist_tax_child_age_exempt', e.target.value)} placeholder="—" />
            <span className={styles.hint}>{t('rsChildExemptHint')}</span>
          </label>
          <label className={styles.field}>{t('rsEturistaId')}
            <input className={styles.input} value={form.eturista_facility_id}
              onChange={e => set('eturista_facility_id', e.target.value)} />
            <span className={styles.hint}>{t('rsEturistaHint')}</span>
          </label>
        </div>

        <label className={styles.checkRow}>
          <input type="checkbox" checked={form.fiscal_enabled} onChange={e => set('fiscal_enabled', e.target.checked)} />
          <span>
            <span className={styles.checkLabel}>{t('rsFiscalEnabled')}</span>
            <span className={styles.hint}>{t('rsFiscalHint')}</span>
          </span>
        </label>

        <label className={styles.field}>{t('rsCheckinInstructions')}
          <textarea className={`${styles.input} ${styles.textarea}`} rows={4} value={form.default_check_in_instructions}
            onChange={e => set('default_check_in_instructions', e.target.value)} placeholder={t('rsCheckinPlaceholder')} />
        </label>

        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>{saving ? t('saving') : t('save')}</button>
        </div>
      </div>
    </div>
  )
}
