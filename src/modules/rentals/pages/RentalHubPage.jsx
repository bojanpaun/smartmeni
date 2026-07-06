import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { formatMoney } from '../../../lib/currencies'
import { useContentTranslations } from '../../../lib/useContentTranslations'
import LanguageSwitcher from '../../../i18n/LanguageSwitcher'
import styles from './RentalHub.module.css'

// Rental landing hub (marketing) — sajt rental biznisa. Izlaže smještaj (+kasnije vozila)
// sa CTA-om na booking (/rent). Za rental-only tenanta ovo je /{slug} (root routing).
// Katalog kroz anon list_rental_assets (bez datuma). Vozila (RENT-FLEET) = zaseban blok kasnije.

const AMENITIES = {
  wifi: '📶', klima: '❄️', kuhinja: '🍳', bazen: '🏊', parking: '🅿️', pogled_more: '🌊', roštilj: '🔥',
}

export default function RentalHubPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('renthub')
  const locale = i18n.language === 'en' ? 'en-US' : 'sr-Latn'

  const [restaurant, setRestaurant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [assets, setAssets] = useState([])
  const tr = useContentTranslations(restaurant?.id)

  useEffect(() => {
    supabase.from('restaurants')
      .select('id, name, slug, logo_url, description, phone, location, color, active_verticals')
      .ilike('slug', slug).single()
      .then(async ({ data }) => {
        setRestaurant(data)
        if (data?.id && (data.active_verticals || []).includes('rental')) {
          const { data: list } = await supabase.rpc('list_rental_assets', { p_restaurant_id: data.id })
          setAssets(list || [])
        }
        setLoading(false)
      })
  }, [slug])

  const nm = (a) => tr('rental_asset', a.asset_id, 'name', a.name)
  const desc = (a) => tr('rental_asset', a.asset_id, 'description', a.description)
  const cur = restaurant?.currency || 'EUR'
  const brand = restaurant?.color || '#0d7a52'
  const heroPhoto = assets.find(a => (a.photos || []).length)?.photos?.[0] || null

  if (loading) return <div className={styles.center}><div className={styles.spinner} /></div>
  if (!restaurant || !(restaurant.active_verticals || []).includes('rental')) {
    return <div className={styles.center}><div className={styles.notFound}>🏖️<p>{t('notFound')}</p></div></div>
  }

  return (
    <div className={styles.page}>
      {/* HERO */}
      <header className={styles.hero} style={heroPhoto
        ? { backgroundImage: `linear-gradient(rgba(10,30,22,.55),rgba(10,30,22,.65)), url(${heroPhoto})` }
        : { background: `linear-gradient(135deg, ${brand}, #0a3b2a)` }}>
        <div className={styles.heroNav}>
          {restaurant.logo_url && <img src={restaurant.logo_url} alt={restaurant.name} className={styles.logo} />}
          <span className={styles.heroBrand}>{restaurant.name}</span>
          <LanguageSwitcher variant="dark" />
        </div>
        <div className={styles.heroInner}>
          <h1 className={styles.heroTitle}>{restaurant.description || t('tagline')}</h1>
          {restaurant.location && <p className={styles.heroLoc}>📍 {restaurant.location}</p>}
          <button className={styles.heroCta} style={{ color: brand }} onClick={() => navigate(`/${slug}/rent`)}>
            {t('bookNow')} →
          </button>
        </div>
      </header>

      {/* SMJEŠTAJ IZLOG */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('ourPlaces')}</h2>
        {assets.length === 0 && <p className={styles.empty}>{t('noneYet')}</p>}
        <div className={styles.grid}>
          {assets.map(a => (
            <a key={a.asset_id} className={styles.card} onClick={() => navigate(`/${slug}/rent`)}>
              <div className={styles.cardPhoto}>
                {(a.photos || []).length
                  ? <img src={a.photos[0]} alt={nm(a)} loading="lazy" decoding="async" onError={e => { e.currentTarget.style.display = 'none' }} />
                  : <span className={styles.cardPhotoPh}>🏠</span>}
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardName}>{nm(a)}</div>
                {(a.location_name || a.city) && <div className={styles.cardLoc}>📍 {[a.location_name, a.city].filter(Boolean).join(', ')}</div>}
                {desc(a) && <div className={styles.cardDesc}>{desc(a)}</div>}
                <div className={styles.cardMeta}>
                  {a.max_guests ? <span>👥 {a.max_guests}</span> : null}
                  {a.bedrooms ? <span>🛏️ {a.bedrooms}</span> : null}
                  {(a.amenities || []).slice(0, 3).map(k => <span key={k}>{AMENITIES[k] || '•'}</span>)}
                </div>
                <div className={styles.cardFoot}>
                  {a.base_price != null && (
                    <span className={styles.cardPrice}>
                      <span className={styles.from}>{t('fromLabel')}</span> {formatMoney(a.base_price, cur, locale)}<span className={styles.per}>{t('perNight')}</span>
                    </span>
                  )}
                  <span className={styles.cardBtn} style={{ background: brand }}>{t('reserve')}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* KONTAKT */}
      {(restaurant.phone || restaurant.location) && (
        <section className={styles.contact}>
          <h2 className={styles.sectionTitle}>{t('contact')}</h2>
          <div className={styles.contactRows}>
            {restaurant.phone && <div className={styles.contactRow}>📞 {restaurant.phone}</div>}
            {restaurant.location && <div className={styles.contactRow}>📍 {restaurant.location}</div>}
          </div>
        </section>
      )}

      <footer className={styles.footer}>Powered by <strong>rest.by.me</strong></footer>
    </div>
  )
}
