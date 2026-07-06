import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { formatMoney } from '../../../lib/currencies'
import { useContentTranslations } from '../../../lib/useContentTranslations'
import { landingFieldPath } from '../../../lib/contentTranslate'
import { useSeo } from '../../../lib/useSeo'
import LanguageSwitcher from '../../../i18n/LanguageSwitcher'
import styles from './RentalHub.module.css'

// Rental landing hub (marketing) — sajt rental biznisa. Renderuje landing_pages blokove
// (page_type='rental', uređuje se u RentalLandingEditor) sa auto-fallback-om na jednostavan
// izgled kad nema blokova. `accommodation` blok = izlog smještaja (list_rental_assets).
// Vozila (RENT-FLEET) = zaseban blok/sekcija kasnije.

const AMENITIES = { wifi: '📶', klima: '❄️', kuhinja: '🍳', bazen: '🏊', parking: '🅿️', pogled_more: '🌊', roštilj: '🔥' }
const parseUrls = (s) => (s || '').split('\n').map(x => x.trim()).filter(x => x.startsWith('http'))
const parseLines = (s) => (s || '').split('\n').map(x => x.trim()).filter(Boolean)

export default function RentalHubPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('renthub')
  const locale = i18n.language === 'en' ? 'en-US' : 'sr-Latn'

  const [restaurant, setRestaurant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [assets, setAssets] = useState([])
  const [blocks, setBlocks] = useState(null)   // enabled landing blocks, ili null (fallback)
  const tr = useContentTranslations(restaurant?.id)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('restaurants')
        .select('id, name, slug, logo_url, description, phone, location, color, currency, active_verticals')
        .ilike('slug', slug).single()
      setRestaurant(data)
      if (data?.id && (data.active_verticals || []).includes('rental')) {
        const [{ data: list }, { data: lp }] = await Promise.all([
          supabase.rpc('list_rental_assets', { p_restaurant_id: data.id }),
          supabase.from('landing_pages').select('blocks').eq('restaurant_id', data.id).eq('page_type', 'rental').maybeSingle(),
        ])
        setAssets(list || [])
        const enabled = (lp?.blocks || []).filter(b => b.enabled)
        setBlocks(enabled.length ? enabled : null)
      }
      setLoading(false)
    }
    load()
  }, [slug])

  const nm = (a) => tr('rental_asset', a.asset_id, 'name', a.name)
  const desc = (a) => tr('rental_asset', a.asset_id, 'description', a.description)
  // AI prevod landing blokova (ogledalo HotelLandingPage): prevodi žive u content_translations
  // (okida ih RentalLandingEditor), čita se preko stabilne putanje polja. me/bez prevoda → izvor.
  const L = (...parts) => landingFieldPath('rental', ...parts)
  const trL = (path, fallback) => tr('landing_block', restaurant?.id, path, fallback)
  const cur = restaurant?.currency || 'EUR'
  const brand = restaurant?.color || '#0d7a52'

  useSeo(restaurant?.name ? `${restaurant.name} · ${t('seoTitle')}` : null, tr('restaurant', restaurant?.id, 'description', restaurant?.description) || t('tagline'))

  if (loading) return <div className={styles.center}><div className={styles.spinner} /></div>
  if (!restaurant || !(restaurant.active_verticals || []).includes('rental')) {
    return <div className={styles.center}><div className={styles.notFound}>🏖️<p>{t('notFound')}</p></div></div>
  }

  const heroPhoto = assets.find(a => (a.photos || []).length)?.photos?.[0] || null

  const renderShowcase = () => (
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
  )

  const renderHero = (data) => (
    <header className={styles.hero} style={data?.bg_image_url || heroPhoto
      ? { backgroundImage: `linear-gradient(rgba(10,30,22,.55),rgba(10,30,22,.65)), url(${data?.bg_image_url || heroPhoto})` }
      : { background: `linear-gradient(135deg, ${brand}, #0a3b2a)` }}>
      <div className={styles.heroNav}>
        {restaurant.logo_url && <img src={restaurant.logo_url} alt={restaurant.name} className={styles.logo} />}
        <span className={styles.heroBrand}>{restaurant.name}</span>
        <LanguageSwitcher variant="dark" />
      </div>
      <div className={styles.heroInner}>
        <h1 className={styles.heroTitle}>{trL(L('hero', 'title'), data?.title) || restaurant.description || t('tagline')}</h1>
        {data?.subtitle
          ? <p className={styles.heroLoc}>{trL(L('hero', 'subtitle'), data.subtitle)}</p>
          : restaurant.location && <p className={styles.heroLoc}>📍 {restaurant.location}</p>}
        <button className={styles.heroCta} style={{ color: brand }} onClick={() => navigate(`/${slug}/rent`)}>
          {trL(L('hero', 'cta_text'), data?.cta_text) || t('bookNow')} →
        </button>
      </div>
    </header>
  )

  const renderContact = (data) => {
    const phone = data?.phone || restaurant.phone
    const loc = restaurant.location
    if (!phone && !loc && !data?.email) return null
    return (
      <section className={styles.contact}>
        <h2 className={styles.sectionTitle}>{t('contact')}</h2>
        <div className={styles.contactRows}>
          {phone && <a href={`tel:${phone}`} className={styles.contactRow}>📞 {phone}</a>}
          {data?.email && <a href={`mailto:${data.email}`} className={styles.contactRow}>✉️ {data.email}</a>}
          {data?.hours && <div className={styles.contactRow}>⏰ {trL(L('contact', 'hours'), data.hours)}</div>}
          {loc && <div className={styles.contactRow}>📍 {loc}</div>}
        </div>
      </section>
    )
  }

  const renderBlock = (block, idx) => {
    const d = block.data || {}
    switch (block.type) {
      case 'hero': return <div key={idx}>{renderHero(d)}</div>
      case 'accommodation': return <div key={idx}>{renderShowcase()}</div>
      case 'about': {
        if (!d.text) return null
        return (
          <section key={idx} className={styles.section}>
            <div className={styles.aboutWrap} data-layout={d.layout || 'image-right'}>
              <p className={styles.aboutText}>{trL(L('about', 'text'), d.text)}</p>
              {d.image_url && d.layout !== 'text-only' && <img src={d.image_url} alt="" loading="lazy" decoding="async" className={styles.aboutImg} />}
            </div>
          </section>
        )
      }
      case 'gallery': {
        const imgs = parseUrls(d.image_urls)
        if (!imgs.length) return null
        return (
          <section key={idx} className={styles.section}>
            <div className={styles.galleryGrid}>
              {imgs.map((u, i) => <img key={i} src={u} alt="" loading="lazy" decoding="async" className={styles.galleryImg} />)}
            </div>
          </section>
        )
      }
      case 'amenities': {
        const items = parseLines(d.items)
        if (!items.length) return null
        return (
          <section key={idx} className={styles.section}>
            <div className={styles.amenitiesGrid}>
              {items.map((it, i) => <div key={i} className={styles.amenityItem}>{trL(L('amenities', 'items', i), it)}</div>)}
            </div>
          </section>
        )
      }
      case 'reviews': {
        const reviews = Array.isArray(d.reviews) ? d.reviews : []
        if (!reviews.length) return null
        return (
          <section key={idx} className={styles.section}>
            <div className={styles.reviewsGrid}>
              {reviews.map((r, i) => (
                <div key={i} className={styles.reviewCard}>
                  <div className={styles.reviewStars}>{'★'.repeat(r.rating || 5)}{'☆'.repeat(5 - (r.rating || 5))}</div>
                  <p className={styles.reviewText}>{trL(L('reviews', 'reviews', i, 'text'), r.text)}</p>
                  <div className={styles.reviewMeta}><span>{r.name}</span>{r.date && <span>{r.date}</span>}</div>
                </div>
              ))}
            </div>
          </section>
        )
      }
      case 'cta_banner': {
        if (!d.title) return null
        return (
          <div key={idx} className={styles.ctaBanner} style={{ background: brand }}>
            <div>
              <h2 className={styles.ctaBannerTitle}>{trL(L('cta_banner', 'title'), d.title)}</h2>
              {d.subtitle && <p className={styles.ctaBannerSub}>{trL(L('cta_banner', 'subtitle'), d.subtitle)}</p>}
            </div>
            {d.btn_text && <a href={d.btn_link || `/${slug}/rent`} className={styles.ctaBannerBtn}>{trL(L('cta_banner', 'btn_text'), d.btn_text)}</a>}
          </div>
        )
      }
      case 'location': {
        if (!d.address && !d.maps_embed_url) return null
        return (
          <section key={idx} className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('location')}</h2>
            {d.address && <div className={styles.contactRow} style={{ marginBottom: 12 }}>📍 {d.address}</div>}
            {d.maps_embed_url && <iframe src={d.maps_embed_url} className={styles.mapsEmbed} allowFullScreen referrerPolicy="no-referrer-when-downgrade" title="Lokacija" />}
          </section>
        )
      }
      case 'contact': return <div key={idx}>{renderContact(d)}</div>
      default: return null
    }
  }

  const footer = <footer className={styles.footer}>Powered by <strong>rest.by.me</strong></footer>

  // Uređen sajt (blokovi) — inače auto-fallback (jednostavan izgled).
  if (blocks) {
    return <div className={styles.page}>{blocks.map(renderBlock)}{footer}</div>
  }
  return (
    <div className={styles.page}>
      {renderHero(null)}
      {renderShowcase()}
      {renderContact(null)}
      {footer}
    </div>
  )
}
