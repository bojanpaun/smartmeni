import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'
import styles from './BillingSuccess.module.css'

export default function BillingSuccess() {
  const navigate = useNavigate()
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
          <div className={styles.title}>Obrađujemo plaćanje...</div>
          <div className={styles.desc}>Molimo sačekaj trenutak.</div>
        </div>
      )}

      {status === 'success' && (
        <div className={styles.card}>
          <div className={styles.successIcon}>🎉</div>
          <div className={styles.title}>Dobrodošao na Pro!</div>
          <div className={styles.desc}>
            Tvoj restoran sada ima pristup svim Pro funkcionalnostima.
            Hvala na povjerenju!
          </div>
          <div className={styles.features}>
            <div className={styles.feature}>✓ Neograničene stavke i slike</div>
            <div className={styles.feature}>✓ Napredna analitika</div>
            <div className={styles.feature}>✓ Predlošci i brending</div>
            <div className={styles.feature}>✓ Prioritetna podrška</div>
          </div>
          <button className={styles.btn} onClick={() => navigate('/admin')}>
            Idi na kontrolnu tablu →
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className={styles.card}>
          <div className={styles.errorIcon}>⚠️</div>
          <div className={styles.title}>Nešto nije u redu</div>
          <div className={styles.desc}>
            Ako si završio plaćanje, tvoj plan će biti ažuriran uskoro.
            Kontaktiraj nas na support@smartmeni.me ako problem potraje.
          </div>
          <button className={styles.btn} onClick={() => navigate('/admin/billing')}>
            Nazad na naplatu
          </button>
        </div>
      )}
    </div>
  )
}
