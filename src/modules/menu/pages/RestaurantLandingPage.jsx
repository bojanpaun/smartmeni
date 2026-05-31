import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import LanguageSwitcher from '../../../i18n/LanguageSwitcher'
import styles from './RestaurantLanding.module.css'

const T = {
  me: {
    loading: 'Učitavanje...',
    notFound: 'Restoran nije pronađen.',
    menu: 'Pogledaj meni',
    viewFullMenu: 'Pogledaj cijeli meni →',
    contact: 'Kontakt',
    location: 'Lokacija',
    reservation: 'Rezerviši sto',
    hotelLink: 'Hotel — info i smještaj',
  },
  en: {
    loading: 'Loading...',
    notFound: 'Restaurant not found.',
    menu: 'View menu',
    viewFullMenu: 'View full menu →',
    contact: 'Contact',
    location: 'Location',
    reservation: 'Book a table',
    hotelLink: 'Hotel — info & rooms',
  },
}

export default function RestaurantLandingPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const [lang, setLang] = useState(i18n.language || 'me')
  const isEn = lang === 'en'
  const t = isEn ? T.en : T.me

  const [restaurant, setRestaurant] = useState(null)
  const [blocks, setBlocks] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: rest, error } = await supabase
        .from('restaurants')
        .select('*')
        .ilike('slug', slug)
        .single()

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

  useEffect(() => {
    const onLangChange = (lng) => setLang(lng)
    i18n.on('languageChanged', onLangChange)
    return () => i18n.off('languageChanged', onLangChange)
  }, [i18n])

  if (loading) return (
    <div className={styles.loadWrap}>
      <div className={styles.spinner} />
    </div>
  )

  if (notFound) return (
    <div className={styles.loadWrap}>
      <p className={styles.notFound}>{t.notFound}</p>
    </div>
  )

  const parseLines = (str) => (str || '').split('\n').map(s => s.trim()).filter(Boolean)
  const parseUrls = (str) => (str || '').split('\n').map(s => s.trim()).filter(s => s.startsWith('http'))

  // If blocks are configured, render block-based layout
  if (blocks && blocks.length > 0) {
    return (
      <div className={styles.page}>
        {blocks.map((block, idx) => {
          switch (block.type) {
            case 'hero':
              return (
                <div key={idx} className={styles.hero}>
                  {block.data.bg_image_url && (
                    <img src={block.data.bg_image_url} alt="" className={styles.heroBg} />
                  )}
                  <div className={styles.heroOverlay} />
                  <div className={styles.heroContent}>
                    <div className={styles.langRow}><LanguageSwitcher variant="dark" /></div>
                    {restaurant.logo_url && (
                      <img src={restaurant.logo_url} alt={restaurant.name} className={styles.logo} />
                    )}
                    <h1 className={styles.restName}>{block.data.title || restaurant.name}</h1>
                    {(block.data.subtitle || restaurant.description) && (
                      <p className={styles.restDesc}>{block.data.subtitle || restaurant.description}</p>
                    )}
                    <button className={styles.heroCta} onClick={() => navigate(`/${slug}`)}>
                      🍽️ {t.menu}
                    </button>
                  </div>
                </div>
              )

            case 'story':
              if (!block.data.text) return null
              return (
                <section key={idx} className={styles.section}>
                  <div className={styles.storyWrap}>
                    <p className={styles.storyText}>{block.data.text}</p>
                    {block.data.image_url && (
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
                  <div className={styles.categoryGrid}>
                    {categories.map(cat => (
                      <a key={cat.id} href={`/${slug}`} className={styles.categoryCard}>
                        {cat.name}
                      </a>
                    ))}
                  </div>
                  <div className={styles.menuLink}>
                    <button className={styles.menuLinkBtn} onClick={() => navigate(`/${slug}`)}>
                      {t.viewFullMenu}
                    </button>
                  </div>
                </section>
              )

            case 'gallery': {
              const imgs = parseUrls(block.data.image_urls)
              if (imgs.length === 0) return null
              return (
                <section key={idx} className={styles.section}>
                  <div className={styles.galleryGrid}>
                    {imgs.map((url, i) => (
                      <img key={i} src={url} alt="" className={styles.galleryImg} loading="lazy" />
                    ))}
                  </div>
                </section>
              )
            }

            case 'hours_location': {
              const locAddress = block.data.address || restaurant.address
              if (!locAddress && !block.data.hours && !block.data.maps_embed_url) return null
              return (
                <section key={idx} className={styles.section}>
                  <div className={styles.infoCard}>
                    {locAddress && (
                      <div className={styles.infoRow}>
                        <span className={styles.infoIcon}>📍</span>
                        <span>{locAddress}</span>
                      </div>
                    )}
                    {block.data.hours && (
                      <div className={styles.infoRow}>
                        <span className={styles.infoIcon}>⏰</span>
                        <span>{block.data.hours}</span>
                      </div>
                    )}
                    {block.data.maps_embed_url && (
                      <iframe
                        src={block.data.maps_embed_url}
                        className={styles.mapsEmbed}
                        allowFullScreen=""
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        title="Lokacija"
                      />
                    )}
                  </div>
                </section>
              )
            }

            case 'reservation_cta':
              return (
                <div key={idx} className={styles.reservationCta}>
                  <h2 className={styles.reservationCtaTitle}>
                    {block.data.text || t.reservation}
                  </h2>
                  {block.data.subtitle && (
                    <p className={styles.reservationCtaSub}>{block.data.subtitle}</p>
                  )}
                  <button className={styles.reservationBtn} onClick={() => navigate(`/${slug}/rezervacija`)}>
                    📅 {t.reservation}
                  </button>
                </div>
              )

            default:
              return null
          }
        })}

        <footer className={styles.footer}>
          <p>Powered by <strong>RestByMe</strong></p>
        </footer>
      </div>
    )
  }

  // Static fallback — show basic restaurant info
  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        {restaurant.logo_url && (
          <img src={restaurant.logo_url} alt={restaurant.name} className={styles.heroBg} style={{ opacity: 0.15 }} />
        )}
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <div className={styles.langRow}><LanguageSwitcher variant="dark" /></div>
          {restaurant.logo_url && (
            <img src={restaurant.logo_url} alt={restaurant.name} className={styles.logo} />
          )}
          <h1 className={styles.restName}>{restaurant.name}</h1>
          {restaurant.description && (
            <p className={styles.restDesc}>{restaurant.description}</p>
          )}
          <button className={styles.heroCta} onClick={() => navigate(`/${slug}`)}>
            🍽️ {t.menu}
          </button>
        </div>
      </div>

      {categories.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>🍽️ {t.menu}</h2>
          <div className={styles.categoryGrid}>
            {categories.map(cat => (
              <a key={cat.id} href={`/${slug}`} className={styles.categoryCard}>
                {cat.name}
              </a>
            ))}
          </div>
          <div className={styles.menuLink}>
            <button className={styles.menuLinkBtn} onClick={() => navigate(`/${slug}`)}>
              {t.viewFullMenu}
            </button>
          </div>
        </section>
      )}

      {(restaurant.phone || restaurant.email || restaurant.address) && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.contact}</h2>
          <div className={styles.infoCard}>
            {restaurant.phone && (
              <a href={`tel:${restaurant.phone}`} className={styles.infoRow}>
                <span className={styles.infoIcon}>📞</span>
                <span>{restaurant.phone}</span>
              </a>
            )}
            {restaurant.email && (
              <a href={`mailto:${restaurant.email}`} className={styles.infoRow}>
                <span className={styles.infoIcon}>✉️</span>
                <span>{restaurant.email}</span>
              </a>
            )}
            {restaurant.address && (
              <div className={styles.infoRow}>
                <span className={styles.infoIcon}>📍</span>
                <span>{restaurant.address}</span>
              </div>
            )}
          </div>
        </section>
      )}

      <footer className={styles.footer}>
        <p>Powered by <strong>RestByMe</strong></p>
      </footer>
    </div>
  )
}
