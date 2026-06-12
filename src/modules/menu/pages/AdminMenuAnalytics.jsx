// src/modules/menu/pages/AdminMenuAnalytics.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './AdminMenu.module.css'
import gsStyles from './GeneralSettings.module.css'

export default function AdminMenuAnalytics() {
  const { t } = useTranslation('admin')
  const { restaurant } = usePlatform()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!restaurant) return
    Promise.all([
      supabase.from('categories').select('*').eq('restaurant_id', restaurant.id),
      supabase.from('menu_items').select('*').eq('restaurant_id', restaurant.id),
    ]).then(([cats, its]) => {
      setCategories(cats.data || [])
      setItems(its.data || [])
      setLoading(false)
    })
  }, [restaurant])

  if (loading) return <div className={gsStyles.loading}>{t('loading')}</div>

  return (
    <div className={gsStyles.page}>
      <div className={gsStyles.header}>
        <h1 className={gsStyles.title}>{t('amAnalyticsTitle')}</h1>
        <p className={gsStyles.subtitle}>{t('amAnalyticsSubtitle')}</p>
      </div>

      {/* Metrike */}
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>{t('amMetricDishes')}</div>
          <div className={styles.metricVal}>{items.filter(i => i.is_visible).length}</div>
          <div className={styles.metricSub}>{t('amMetricOf', { total: items.length })}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>{t('amCategories')}</div>
          <div className={styles.metricVal}>{categories.length}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>{t('amMetricUrl')}</div>
          <div className={styles.metricVal} style={{ fontSize: 14 }}>
            restby.me/{restaurant?.slug}
          </div>
        </div>
      </div>

      {/* Brzi start */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>{t('amQuickStart')}</div>
        {categories.length === 0 && (
          <div className={styles.startStep}>
            <span className={styles.startNum}>1</span>
            <div>
              <div className={styles.startTitle}>{t('amStep1Title')}</div>
              <div className={styles.startDesc}>{t('amStep1Desc')}</div>
            </div>
            <button className={styles.startBtn} onClick={() => navigate('/admin/menu')}>
              {t('add')} →
            </button>
          </div>
        )}
        {categories.length > 0 && items.length === 0 && (
          <div className={styles.startStep}>
            <span className={styles.startNum}>2</span>
            <div>
              <div className={styles.startTitle}>{t('amStep2Title')}</div>
              <div className={styles.startDesc}>{t('amStep2Desc')}</div>
            </div>
            <button className={styles.startBtn} onClick={() => navigate('/admin/menu')}>
              {t('add')} →
            </button>
          </div>
        )}
        {items.length > 0 && (
          <div className={styles.startStep}>
            <span className={styles.startNum} style={{ background: '#e0f5ec', color: '#0d7a52' }}>✓</span>
            <div>
              <div className={styles.startTitle}>{t('amStep3Title')}</div>
              <div className={styles.startDesc}>{t('amStep3Desc')}</div>
            </div>
            <a href={`/${restaurant.slug}`} target="_blank" rel="noreferrer" className={styles.startBtn}>
              {t('amOpenArrow')}
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
