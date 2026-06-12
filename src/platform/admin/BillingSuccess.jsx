import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'
import styles from './BillingSuccess.module.css'

export default function BillingSuccess() {
  const navigate = useNavigate()
  const { t } = useTranslation('admin')
  const [searchParams] = useSearchParams()
  const { restaurant, setRestaurant } = usePlatform()
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const subscriptionId = searchParams.get('subscription_id')
    if (!subscriptionId || !restaurant) {
      setStatus('error')
      return
    }

    // Sačekaj webhook da obradi (max 5 sekundi) pa provjeri bazu
    const checkStatus = async () => {
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 1500))
        const { data } = await supabase
          .from('restaurants')
          .select('plan, subscription_id')
          .eq('id', restaurant.id)
          .single()

        if (data?.plan === 'pro') {
          setRestaurant({ ...restaurant, plan: 'pro', subscription_id: data.subscription_id })
          setStatus('success')
          return
        }
      }
      // Webhook možda kasni — svejedno prikaži uspjeh
      setStatus('success')
    }

    checkStatus()
  }, [restaurant])

  return (
    <div className={styles.page}>
      {status === 'loading' && (
        <div className={styles.card}>
          <div className={styles.spinner}>⟳</div>
          <div className={styles.title}>{t('bsProcessing')}</div>
          <div className={styles.desc}>{t('bsWaitMoment')}</div>
        </div>
      )}

      {status === 'success' && (
        <div className={styles.card}>
          <div className={styles.successIcon}>🎉</div>
          <div className={styles.title}>{t('bsWelcomePro')}</div>
          <div className={styles.desc}>
            {t('bsProDesc')}
          </div>
          <div className={styles.features}>
            <div className={styles.feature}>✓ {t('bsFeat1')}</div>
            <div className={styles.feature}>✓ {t('bsFeat2')}</div>
            <div className={styles.feature}>✓ {t('bsFeat3')}</div>
            <div className={styles.feature}>✓ {t('bsFeat4')}</div>
          </div>
          <button className={styles.btn} onClick={() => navigate('/admin')}>
            {t('bsToDashboard')} →
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className={styles.card}>
          <div className={styles.errorIcon}>⚠️</div>
          <div className={styles.title}>{t('bsErrorTitle')}</div>
          <div className={styles.desc}>
            {t('bsErrorDesc')}
          </div>
          <button className={styles.btn} onClick={() => navigate('/admin/billing')}>
            {t('bsBackToBilling')}
          </button>
        </div>
      )}
    </div>
  )
}
