import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { toEmbedUrl } from '../../../utils/videoUrl'
import LanguageSwitcher from '../../../i18n/LanguageSwitcher'
import styles from './RestaurantLanding.module.css'

const T = {
  me: {
    loading: 'Učitavanje...', notFound: 'Restoran nije pronađen.',
    menu: 'Pogledaj meni', viewFullMenu: 'Pogledaj cijeli meni →',
    contact: 'Kontakt', location: 'Lokacija', reservation: 'Rezerviši sto',
    hotelLink: 'Hotel — info i smještaj', reviews: 'Recenzije gostiju',
    specials: 'Specijaliteti', hours: 'Radno vrijeme',
  },
  en: {
    loading: 'Loading...', notFound: 'Restaurant not found.',
    menu: 'View menu', viewFullMenu: 'View full menu →',
    contact: 'Contact', location: 'Location', reservation: 'Book a table',
    hotelLink: 'Hotel — info & rooms', reviews: 'Guest reviews',
    specials: 'Specials', hours: 'Opening hours',
  },
}

const isPreview = new URLSearchParams(window.location.search).get('preview') === 'true'

export default function RestaurantLandingPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const [lang, setLang] = useState(i18n.language || 'me')
  const t = lang === 'en' ? T.en : T.me

  const [restaurant, setRestaurant] = useState(null)
  const [blocks, setBlocks] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: rest, error } = await supabase
        .from('restaurants').select('*').ilike('slug', slug).single()
      if (error || !rest) { setNotFound(true); setLoading(false); return }
      setRestaurant(rest)
      const [{ data: lp }, { data: cats }] = await Promise.all([
        supabase.from('landing_pages').select('blocks, seo_title, seo_description')
          .eq('restaurant_id', rest.id).eq('page_type', 'restaurant').maybeSingle(),
        supabase.from('categories').select('id, name, sort_order')
          .eq('restaurant_id', rest.id).order('sort_order', { ascending: true }).limit(6),
      ])
      setBlocks(lp?.blocks?.filter(b => b.enabled) || null)
      setCategories(cats || [])
      setLoading(false)
    }
    load()
  }, [slug])

  // Preview mode: listen for postMessage from editor
  useEffect(() => {
    if (!isPreview) return
    const handler = (e) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type !== 'PREVIEW_UPDATE') return
      setBlocks(e.data.blocks.filter(b => b.enabled))
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  useEffect(() => {
    const onLang = (lng) => setLang(lng)
    i18n.on('languageChanged', onLang)
    return () => i18n.off('languageChanged', onLang)
  }, [i18n])

  if (loading) return <div className={styles.loadWrap}><div className={styles.spinner} /></div>
  if (notFound) return <div className={styles.loadWrap}><p className={styles.notFound}>{t.notFound}</p></div>

  const parseLines = (str) => (str || '').split('\n').map(s => s.trim()).filter(Boolean)
  const parseUrls = (str) => (str || '').split('\n').map(s => s.trim()).filter(s => s.startsWith('http'))

  const renderBlock = (block, idx) => {
    const layout = block.data?.layout

    switch (block.type) {

      case 'hero':
        return (
          <div
            key={idx}
            className={`${styles.hero} ${layout === 'compact' ? styles.heroCompact : ''} ${layout === 'split' ? styles.heroSplit : ''}`}
          >
            {block.data.bg_image_url && <img src={block.data.bg_image_url} alt="" className={styles.heroBg} />}
            <div className={styles.heroOverlay} />
            <div className={styles.heroContent}>
              <div className={styles.langRow}><LanguageSwitcher variant="dark" /></div>
              {restaurant.logo_url && <img src={restaurant.logo_url} alt={restaurant.name} className={styles.logo} />}
              <h1 className={styles.restName}>{block.data.title || restaurant.name}</h1>
              {(block.data.subtitle || restaurant.description) && (
                <p className={styles.restDesc}>{block.data.subtitle || restaurant.description}</p>
              )}
              <button className={styles.heroCta} onClick={() => navigate(`/${slug}`)}>🍽️ {t.menu}</button>
            </div>
          </div>
        )

      case 'story':
        if (!block.data.text) return null
        return (
          <section key={idx} className={styles.section}>
            <div className={styles.storyWrap} data-layout={layout || 'image-right'}>
              <p className={styles.storyText}>{block.data.text}</p>
              {block.data.image_url && layout !== 'text-only' && (
                <img src={block.data.image_url} alt="" className={styles.storyImg} />
              )}
            </div>
          </section>
        )

      case 'menu_preview':
        if (categories.length === 0) return null
        return (
          <section key={idx} className={styles.section}>
            <h2 className={styles.sectionTitle}>🍽️ {t.menu}</h2>
            <div className={layout === 'list' ? styles.categoryList : layout === 'cards' ? styles.categoryCards : styles.categoryGrid}>
              {categories.map(cat => (
                <a key={cat.id} href={`/${slug}`} className={styles.categoryCard}>{cat.name}</a>
              ))}
            </div>
            <div className={styles.menuLink}>
              <button className={styles.menuLinkBtn} onClick={() => navigate(`/${slug}`)}>{t.viewFullMenu}</button>
            </div>
          </section>
        )

      case 'specials': {
        const items = Array.isArray(block.data.specials) ? block.data.specials : []
        if (items.length === 0) return null
        return (
          <section key={idx} className={styles.section}>
            <h2 className={styles.sectionTitle}>{t.specials}</h2>
            <div className={layout === 'list' ? styles.specialsList : styles.specialsGrid}>
              {items.map((item, i) => (
                <div key={i} className={styles.specialCard}>
                  {item.image_url && <img src={item.image_url} alt={item.name} className={styles.specialImg} />}
                  <div className={styles.specialBody}>
                    <div className={styles.specialHeader}>
                      <span className={styles.specialName}>{item.name}</span>
                      {item.price && <span className={styles.specialPrice}>{item.price}</span>}
                    </div>
                    {item.description && <p className={styles.specialDesc}>{item.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      }

      case 'gallery': {
        const imgs = parseUrls(block.data.image_urls)
        if (imgs.length === 0) return null
        const gridClass = layout === 'grid-2' ? styles.galleryGrid2 : layout === 'masonry' ? styles.galleryMasonry : styles.galleryGrid
        return (
          <section key={idx} className={styles.section}>
            <div className={gridClass}>
              {imgs.map((url, i) => <img key={i} src={url} alt="" className={styles.galleryImg} loading="lazy" />)}
            </div>
          </section>
        )
      }

      case 'reviews': {
        const reviews = Array.isArray(block.data.reviews) ? block.data.reviews : []
        if (reviews.length === 0) return null
        return (
          <section key={idx} className={styles.section}>
            <h2 className={styles.sectionTitle}>{t.reviews}</h2>
            <div className={`${styles.reviewsGrid} ${layout === 'list' ? styles.reviewsList : ''}`}>
              {reviews.map((r, i) => (
                <div key={i} className={styles.reviewCard}>
                  <div className={styles.reviewStars}>{'★'.repeat(r.rating || 5)}{'☆'.repeat(5 - (r.rating || 5))}</div>
                  <p className={styles.reviewText}>{r.text}</p>
                  <div className={styles.reviewMeta}>
                    <span className={styles.reviewName}>{r.name}</span>
                    {r.date && <span className={styles.reviewDate}>{r.date}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      }

      case 'video': {
        const embed = toEmbedUrl(block.data.video_url)
        if (!embed) return null
        return (
          <section key={idx} className={`${styles.section} ${layout === 'centered' ? styles.sectionCentered : ''}`}>
            {block.data.title && <h2 className={styles.sectionTitle}>{block.data.title}</h2>}
            <div className={styles.videoWrap}>
              <iframe src={embed} className={styles.videoIframe} allowFullScreen title="Video" />
            </div>
          </section>
        )
      }

      case 'cta_banner':
        if (!block.data.title) return null
        return (
          <div key={idx} className={`${styles.ctaBanner} ${layout === 'left-aligned' ? styles.ctaBannerLeft : ''}`}>
            <div className={styles.ctaBannerContent}>
              <h2 className={styles.ctaBannerTitle}>{block.data.title}</h2>
              {block.data.subtitle && <p className={styles.ctaBannerSub}>{block.data.subtitle}</p>}
            </div>
            {block.data.btn_text && (
              <a href={block.data.btn_link || `/${slug}/rezervacija`} className={styles.ctaBannerBtn}>
                {block.data.btn_text}
              </a>
            )}
          </div>
        )

      case 'hours_location': {
        const locAddress = block.data.address || restaurant.address
        if (!locAddress && !block.data.hours && !block.data.maps_embed_url) return null
        return (
          <section key={idx} className={styles.section}>
            <div className={styles.infoCard}>
              {locAddress && <div className={styles.infoRow}><span className={styles.infoIcon}>📍</span><span>{locAddress}</span></div>}
              {block.data.hours && <div className={styles.infoRow}><span className={styles.infoIcon}>⏰</span><span>{block.data.hours}</span></div>}
            </div>
            {layout !== 'card-only' && block.data.maps_embed_url && (
              <iframe src={block.data.maps_embed_url} className={styles.mapsEmbed} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Lokacija" />
            )}
          </section>
        )
      }

      case 'reservation_cta':
        return (
          <div key={idx} className={`${styles.reservationCta} ${layout === 'card' ? styles.reservationCtaCard : layout === 'minimal' ? styles.reservationCtaMinimal : ''}`}>
            <h2 className={styles.reservationCtaTitle}>{block.data.text || t.reservation}</h2>
            {block.data.subtitle && <p className={styles.reservationCtaSub}>{block.data.subtitle}</p>}
            <button className={styles.reservationBtn} onClick={() => navigate(`/${slug}/rezervacija`)}>
              📅 {t.reservation}
            </button>
          </div>
        )

      default: return null
    }
  }

  if (blocks && blocks.length > 0) {
    return (
      <div className={styles.page}>
        {blocks.map((block, idx) => renderBlock(block, idx))}
        <footer className={styles.footer}><p>Powered by <strong>RestByMe</strong></p></footer>
      </div>
    )
  }

  // Static fallback
  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        {restaurant.logo_url && <img src={restaurant.logo_url} alt={restaurant.name} className={styles.heroBg} style={{ opacity: 0.15 }} />}
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <div className={styles.langRow}><LanguageSwitcher variant="dark" /></div>
          {restaurant.logo_url && <img src={restaurant.logo_url} alt={restaurant.name} className={styles.logo} />}
          <h1 className={styles.restName}>{restaurant.name}</h1>
          {restaurant.description && <p className={styles.restDesc}>{restaurant.description}</p>}
          <button className={styles.heroCta} onClick={() => navigate(`/${slug}`)}>🍽️ {t.menu}</button>
        </div>
      </div>
      {categories.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>🍽️ {t.menu}</h2>
          <div className={styles.categoryGrid}>
            {categories.map(cat => <a key={cat.id} href={`/${slug}`} className={styles.categoryCard}>{cat.name}</a>)}
          </div>
          <div className={styles.menuLink}>
            <button className={styles.menuLinkBtn} onClick={() => navigate(`/${slug}`)}>{t.viewFullMenu}</button>
          </div>
        </section>
      )}
      {(restaurant.phone || restaurant.email || restaurant.address) && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.contact}</h2>
          <div className={styles.infoCard}>
            {restaurant.phone && <a href={`tel:${restaurant.phone}`} className={styles.infoRow}><span className={styles.infoIcon}>📞</span><span>{restaurant.phone}</span></a>}
            {restaurant.email && <a href={`mailto:${restaurant.email}`} className={styles.infoRow}><span className={styles.infoIcon}>✉️</span><span>{restaurant.email}</span></a>}
            {restaurant.address && <div className={styles.infoRow}><span className={styles.infoIcon}>📍</span><span>{restaurant.address}</span></div>}
          </div>
        </section>
      )}
      <footer className={styles.footer}><p>Powered by <strong>RestByMe</strong></p></footer>
    </div>
  )
}
