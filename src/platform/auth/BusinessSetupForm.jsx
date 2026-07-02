import { useTranslation } from 'react-i18next'
import { generateSlug } from './authHelpers'
import styles from './Auth.module.css'

// Kontrolisana forma za postavku biznisa (vertikale, naziv, slug, kontakt).
// Dijele je registracija (korak 2) i OAuth onboarding — stanje drži roditelj,
// a stvarno kreiranje restorana radi roditelj kroz `onSubmit`.
export default function BusinessSetupForm({
  form, set, verticals, toggleVertical, onSubmit, loading, error, onBack, submitLabel,
}) {
  const { t } = useTranslation('auth')

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <div className={styles.field}>
        <label>{t('whatRun')}</label>
        <div className={styles.bizChoices}>
          <label className={`${styles.bizChoice} ${verticals.restaurant ? styles.bizChoiceOn : ''}`}>
            <input type="checkbox" checked={verticals.restaurant} onChange={() => toggleVertical('restaurant')} />
            <span className={styles.bizIcon}>🍽️</span>
            <span className={styles.bizText}>
              <span className={styles.bizName}>{t('bizRestaurant')}</span>
              <span className={styles.bizDesc}>{t('bizRestaurantDesc')}</span>
            </span>
          </label>
          <label className={`${styles.bizChoice} ${verticals.hotel ? styles.bizChoiceOn : ''}`}>
            <input type="checkbox" checked={verticals.hotel} onChange={() => toggleVertical('hotel')} />
            <span className={styles.bizIcon}>🏨</span>
            <span className={styles.bizText}>
              <span className={styles.bizName}>{t('bizHotel')}</span>
              <span className={styles.bizDesc}>{t('bizHotelDesc')}</span>
            </span>
          </label>
        </div>
      </div>
      <div className={styles.field}>
        <label>{verticals.restaurant ? t('restNameReq') : t('objNameReq')}</label>
        <input
          type="text"
          placeholder={verticals.restaurant ? t('restNamePh') : t('objNamePh')}
          value={form.name}
          onChange={e => {
            set('name', e.target.value)
            set('slug', generateSlug(e.target.value))
          }}
          required
        />
      </div>
      <div className={styles.field}>
        <label>{t('yourUrl')}</label>
        <div className={styles.slugWrap}>
          <span className={styles.slugPrefix}>restby.me/</span>
          <input
            type="text"
            value={form.slug}
            onChange={e => set('slug', e.target.value)}
            placeholder={t('slugPh')}
          />
        </div>
      </div>
      <div className={styles.field}>
        <label>{t('location')}</label>
        <input
          type="text"
          placeholder={t('locationPh')}
          value={form.location}
          onChange={e => set('location', e.target.value)}
        />
      </div>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label>{t('phone')}</label>
          <input
            type="text"
            placeholder={t('phonePh')}
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label>{t('hours')}</label>
          <input
            type="text"
            placeholder={t('hoursPh')}
            value={form.hours}
            onChange={e => set('hours', e.target.value)}
          />
        </div>
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <button type="submit" className={styles.btn} disabled={loading}>
        {loading ? t('creatingAccount') : submitLabel}
      </button>
      {onBack && (
        <button type="button" className={styles.btnBack} onClick={onBack}>
          ← {t('back')}
        </button>
      )}
    </form>
  )
}
