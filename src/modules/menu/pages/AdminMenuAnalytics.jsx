// src/modules/menu/pages/AdminMenuAnalytics.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './AdminMenu.module.css'
import gsStyles from './GeneralSettings.module.css'

export default function AdminMenuAnalytics() {
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

  if (loading) return <div className={gsStyles.loading}>Učitavanje...</div>

  return (
    <div className={gsStyles.page}>
      <div className={gsStyles.header}>
        <h1 className={gsStyles.title}>Analitika menija</h1>
        <p className={gsStyles.subtitle}>Pregled stavki, kategorija i statusa digitalnog menija.</p>
      </div>

      {/* Metrike */}
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Jela u meniju</div>
          <div className={styles.metricVal}>{items.filter(i => i.is_visible).length}</div>
          <div className={styles.metricSub}>od {items.length} ukupno</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Kategorije</div>
          <div className={styles.metricVal}>{categories.length}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Vaš URL</div>
          <div className={styles.metricVal} style={{ fontSize: 14 }}>
            smartmeni.me/{restaurant?.slug}
          </div>
        </div>
      </div>

      {/* Brzi start */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Brzi start</div>
        {categories.length === 0 && (
          <div className={styles.startStep}>
            <span className={styles.startNum}>1</span>
            <div>
              <div className={styles.startTitle}>Dodajte kategoriju menija</div>
              <div className={styles.startDesc}>npr. Predjela, Riba, Meso, Piće...</div>
            </div>
            <button className={styles.startBtn} onClick={() => navigate('/admin/menu')}>
              Dodaj →
            </button>
          </div>
        )}
        {categories.length > 0 && items.length === 0 && (
          <div className={styles.startStep}>
            <span className={styles.startNum}>2</span>
            <div>
              <div className={styles.startTitle}>Dodajte prvo jelo</div>
              <div className={styles.startDesc}>Naziv, opis, cijena i slika</div>
            </div>
            <button className={styles.startBtn} onClick={() => navigate('/admin/menu')}>
              Dodaj →
            </button>
          </div>
        )}
        {items.length > 0 && (
          <div className={styles.startStep}>
            <span className={styles.startNum} style={{ background: '#e0f5ec', color: '#0d7a52' }}>✓</span>
            <div>
              <div className={styles.startTitle}>Meni je aktivan!</div>
              <div className={styles.startDesc}>Gosti mogu skenirati QR kod</div>
            </div>
            <a href={`/${restaurant.slug}`} target="_blank" rel="noreferrer" className={styles.startBtn}>
              Otvori →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
