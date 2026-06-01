import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { toEmbedUrl } from '../../../utils/videoUrl'
import LanguageSwitcher from '../../../i18n/LanguageSwitcher'
import styles from './HotelLanding.module.css'

const T = {
  me: {
    book: 'Rezerviši sobu', guestApp: 'Imam rezervaciju', guestAppSub: 'Pregled folija i online usluge',
    spaBook: 'Spa & Wellness', rooms: 'Tipovi smještaja', perNight: '/ noć', guests: 'gost(a)',
    notFound: 'Hotel nije pronađen.', loading: 'Učitavanje...', amenities: 'Pogodnosti',
    from: 'Od', contact: 'Kontakt', address: 'Adresa', bookNow: 'Rezerviši',
    menuLink: 'Restoran / Meni', about: 'O hotelu', gallery: 'Galerija', location: 'Lokacija',
    reviews: 'Recenzije gostiju', faq: 'Česta pitanja',
  },
  en: {
    book: 'Book a room', guestApp: 'I have a reservation', guestAppSub: 'Folio & online services',
    spaBook: 'Spa & Wellness', rooms: 'Room types', perNight: '/ night', guests: 'guest(s)',
    notFound: 'Hotel not found.', loading: 'Loading...', amenities: 'Amenities',
    from: 'From', contact: 'Contact', address: 'Address', bookNow: 'Book',
    menuLink: 'Restaurant / Menu', about: 'About', gallery: 'Gallery', location: 'Location',
    reviews: 'Guest reviews', faq: 'FAQ',
  },
}

const isPreview = new URLSearchParams(window.location.search).get('preview') === 'true'

export default function HotelLandingPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const [lang, setLang] = useState(i18n.language || 'me')
  const t = lang === 'en' ? T.en : T.me

  const [hotel, setHotel] = useState(null)
  const [roomTypes, setRoomTypes] = useState([])
  const [landingBlocks, setLandingBlocks] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: rest, error } = await supabase
        .from('restaurants').select('*').ilike('slug', slug).single()
      if (error || !rest) { setNotFound(true); setLoading(false); return }
      setHotel(rest)
      const [{ data: types }, { data: lp }] = await Promise.all([
        supabase.from('room_types').select('id, name, description, max_occupancy, base_price, amenities, images')
          .eq('restaurant_id', rest.id).eq('is_active', true).order('sort_order', { ascending: true }),
        supabase.from('landing_pages').select('blocks')
          .eq('restaurant_id', rest.id).eq('page_type', 'hotel').maybeSingle(),
      ])
      setRoomTypes(types ?? [])
      const active = lp?.blocks?.filter(b => b.enabled) ?? null
      setLandingBlocks(active && active.length > 0 ? active : null)
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
      setLandingBlocks(e.data.blocks.filter(b => b.enabled))
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

  const parseUrls = (str) => (str || '').split('\n').map(s => s.trim()).filter(s => s.startsWith('http'))
  const parseLines = (str) => (str || '').split('\n').map(s => s.trim()).filter(Boolean)
  const amenitiesArr = (a) => Array.isArray(a) ? a : a && typeof a === 'object' ? Object.values(a) : []
  const firstImage = (imgs) => {
    if (!imgs) return null
    if (Array.isArray(imgs) && imgs.length > 0) return imgs[0]
    if (typeof imgs === 'object') { const v = Object.values(imgs); return v.length > 0 ? v[0] : null }
    return null
  }

  const renderCtas = () => (
    <div className={styles.ctaSection}>
      <button className={styles.ctaPrimary} onClick={() => navigate(`/${slug}/book`)}>
        🛏️ {t.book}
      </button>
      <div className={styles.ctaRow}>
        <button className={styles.ctaSecondary} onClick={() => navigate(`/${slug}/spa`)}>
          <span className={styles.ctaSecLabel}>✨ {t.spaBook}</span>
          <span className={styles.ctaSecSub}>{lang === 'en' ? 'Book a treatment' : 'Booking tretmana'}</span>
        </button>
        <button className={styles.ctaSecondary} onClick={() => navigate(`/${slug}/guest`)}>
          <span className={styles.ctaSecLabel}>🔑 {t.guestApp}</span>
          <span className={styles.ctaSecSub}>{t.guestAppSub}</span>
        </button>
      </div>
    </div>
  )

  const renderRooms = () => {
    if (roomTypes.length === 0) return null
    return (
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t.rooms}</h2>
        <div className={styles.roomGrid}>
          {roomTypes.map(rt => {
            const img = firstImage(rt.images)
            const amens = amenitiesArr(rt.amenities).slice(0, 5)
            return (
              <div key={rt.id} className={styles.roomCard}>
                {img ? <img src={img} alt={rt.name} className={styles.roomImg} /> : <div className={styles.roomImgPlaceholder}>🏨</div>}
                <div className={styles.roomBody}>
                  <div className={styles.roomHeader}>
                    <h3 className={styles.roomName}>{rt.name}</h3>
                    {rt.base_price && (
                      <div className={styles.roomPrice}>
                        <span className={styles.priceFrom}>{t.from}</span>
                        <span className={styles.priceAmount}>€{Number(rt.base_price).toFixed(0)}</span>
                        <span className={styles.priceNight}>{t.perNight}</span>
                      </div>
                    )}
                  </div>
                  {rt.max_occupancy && <div className={styles.roomOccupancy}>👤 max {rt.max_occupancy} {t.guests}</div>}
                  {rt.description && <p className={styles.roomDesc}>{rt.description}</p>}
                  {amens.length > 0 && (
                    <div className={styles.amenities}>
                      {amens.map((a, i) => <span key={i} className={styles.amenityTag}>{a}</span>)}
                    </div>
                  )}
                  <button className={styles.roomBookBtn} onClick={() => navigate(`/${slug}/book`)}>{t.bookNow} →</button>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  const renderBlock = (block, idx) => {
    const layout = block.data?.layout
    switch (block.type) {

      case 'hero': {
        const title = block.data.title || hotel.name
        const subtitle = block.data.subtitle || hotel.description
        return (
          <div key={idx}>
            <div
              className={`${styles.hero} ${layout === 'compact' ? styles.heroCompact : ''} ${layout === 'split' ? styles.heroSplit : ''}`}
              style={block.data.bg_image_url ? { backgroundImage: `url(${block.data.bg_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
            >
              <div className={styles.heroOverlay} />
              <div className={styles.heroContent}>
                <div className={styles.langRow}><LanguageSwitcher variant="dark" /></div>
                {hotel.logo_url && <img src={hotel.logo_url} alt={hotel.name} className={styles.logo} />}
                <h1 className={styles.hotelName}>{title}</h1>
                {subtitle && <p className={styles.hotelDesc}>{subtitle}</p>}
              </div>
            </div>
            {renderCtas()}
          </div>
        )
      }

      case 'about':
        if (!block.data.text) return null
        return (
          <section key={idx} className={styles.section}>
            <h2 className={styles.sectionTitle}>{t.about}</h2>
            <div className={styles.aboutWrap} data-layout={layout || 'image-right'}>
              <p className={styles.aboutText}>{block.data.text}</p>
              {block.data.image_url && layout !== 'text-only' && (
                <img src={block.data.image_url} alt="" className={styles.aboutImg} />
              )}
            </div>
          </section>
        )

      case 'rooms':
        return <div key={idx}>{renderRooms()}</div>

      case 'gallery': {
        const imgs = parseUrls(block.data.image_urls)
        if (imgs.length === 0) return null
        const gridClass = layout === 'grid-2' ? styles.galleryGrid2 : layout === 'masonry' ? styles.galleryMasonry : styles.galleryGrid
        return (
          <section key={idx} className={styles.section}>
            <h2 className={styles.sectionTitle}>{t.gallery}</h2>
            <div className={gridClass}>
              {imgs.map((url, i) => <img key={i} src={url} alt="" className={styles.galleryImg} loading="lazy" />)}
            </div>
          </section>
        )
      }

      case 'amenities': {
        const items = parseLines(block.data.items)
        if (items.length === 0) return null
        const gridClass = layout === 'list' ? styles.amenitiesList : layout === 'cards' ? styles.amenitiesCards : styles.amenitiesGrid
        return (
          <section key={idx} className={styles.section}>
            <h2 className={styles.sectionTitle}>{t.amenities}</h2>
            <div className={gridClass}>
              {items.map((item, i) => <div key={i} className={styles.amenityItem}>{item}</div>)}
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
            <div className={`${styles.reviewsGrid} ${layout === 'list' ? styles.reviewsList : layout === 'featured' ? styles.reviewsFeatured : ''}`}>
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

      case 'faq': {
        const faqs = Array.isArray(block.data.faq) ? block.data.faq : []
        if (faqs.length === 0) return null
        return (
          <section key={idx} className={styles.section}>
            <h2 className={styles.sectionTitle}>{t.faq}</h2>
            <div className={layout === 'two-column' ? styles.faqGrid : styles.faqList}>
              {faqs.map((item, i) => (
                <details key={i} className={styles.faqItem}>
                  <summary className={styles.faqQuestion}>{item.question}<span className={styles.faqChevron}>›</span></summary>
                  <p className={styles.faqAnswer}>{item.answer}</p>
                </details>
              ))}
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
              <a href={block.data.btn_link || `/${slug}/book`} className={styles.ctaBannerBtn}>
                {block.data.btn_text}
              </a>
            )}
          </div>
        )

      case 'location': {
        const locAddress = block.data.address || hotel.address
        if (!locAddress && !block.data.maps_embed_url) return null
        return (
          <section key={idx} className={styles.section}>
            <h2 className={styles.sectionTitle}>{t.location}</h2>
            <div className={styles.infoCard}>
              {locAddress && <div className={styles.infoRow}><span className={styles.infoIcon}>📍</span><span>{locAddress}</span></div>}
            </div>
            {layout !== 'card-only' && block.data.maps_embed_url && (
              <iframe src={block.data.maps_embed_url} className={styles.mapsEmbed} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Lokacija" />
            )}
          </section>
        )
      }

      case 'contact': {
        const phone = block.data.phone || hotel.phone
        const email = block.data.email || hotel.email
        const hours = block.data.hours
        const addr  = hotel.address
        if (!phone && !email && !hours && !addr) return null
        const wrapClass = layout === 'two-column' ? styles.contactTwoCol : layout === 'minimal' ? styles.contactMinimal : styles.infoCard
        return (
          <section key={idx} className={styles.section}>
            <h2 className={styles.sectionTitle}>{t.contact}</h2>
            <div className={wrapClass}>
              {phone && <a href={`tel:${phone}`} className={styles.infoRow}><span className={styles.infoIcon}>📞</span><span>{phone}</span></a>}
              {email && <a href={`mailto:${email}`} className={styles.infoRow}><span className={styles.infoIcon}>✉️</span><span>{email}</span></a>}
              {hours && <div className={styles.infoRow}><span className={styles.infoIcon}>⏰</span><span>{hours}</span></div>}
              {addr  && <div className={styles.infoRow}><span className={styles.infoIcon}>📍</span><span>{addr}</span></div>}
            </div>
          </section>
        )
      }

      default: return null
    }
  }

  const renderFooter = () => (
    <>
      <div className={styles.menuLink}>
        <button className={styles.menuLinkBtn} onClick={() => navigate(`/${slug}`)}>🍽️ {t.menuLink}</button>
      </div>
      <footer className={styles.footer}><p>Powered by <strong>RestByMe</strong></p></footer>
    </>
  )

  if (landingBlocks) {
    return (
      <div className={styles.page}>
        {landingBlocks.map((block, idx) => renderBlock(block, idx))}
        {renderFooter()}
      </div>
    )
  }

  // Static fallback
  return (
    <div className={styles.page}>
      <div className={styles.hero} style={hotel.cover_image_url ? { backgroundImage: `url(${hotel.cover_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <div className={styles.langRow}><LanguageSwitcher variant="dark" /></div>
          {hotel.logo_url && <img src={hotel.logo_url} alt={hotel.name} className={styles.logo} />}
          <h1 className={styles.hotelName}>{hotel.name}</h1>
          {hotel.description && <p className={styles.hotelDesc}>{hotel.description}</p>}
        </div>
      </div>
      {renderCtas()}
      {renderRooms()}
      {(hotel.phone || hotel.address || hotel.email) && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.contact}</h2>
          <div className={styles.infoCard}>
            {hotel.phone && <a href={`tel:${hotel.phone}`} className={styles.infoRow}><span className={styles.infoIcon}>📞</span><span>{hotel.phone}</span></a>}
            {hotel.email && <a href={`mailto:${hotel.email}`} className={styles.infoRow}><span className={styles.infoIcon}>✉️</span><span>{hotel.email}</span></a>}
            {hotel.address && <div className={styles.infoRow}><span className={styles.infoIcon}>📍</span><span>{hotel.address}</span></div>}
          </div>
        </section>
      )}
      {renderFooter()}
    </div>
  )
}
