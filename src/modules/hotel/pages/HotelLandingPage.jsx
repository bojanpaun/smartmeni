import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import LanguageSwitcher from '../../../i18n/LanguageSwitcher'
import styles from './HotelLanding.module.css'

const T = {
  me: {
    book: 'Rezerviši sobu',
    guestApp: 'Imam rezervaciju',
    guestAppSub: 'Pregled folija i online usluge',
    rooms: 'Tipovi smještaja',
    perNight: '/ noć',
    guests: 'gost(a)',
    notFound: 'Hotel nije pronađen.',
    loading: 'Učitavanje...',
    amenities: 'Pogodnosti',
    from: 'Od',
    contact: 'Kontakt',
    address: 'Adresa',
    bookNow: 'Rezerviši',
    menuLink: 'Restoran / Meni',
  },
  en: {
    book: 'Book a room',
    guestApp: 'I have a reservation',
    guestAppSub: 'Folio & online services',
    rooms: 'Room types',
    perNight: '/ night',
    guests: 'guest(s)',
    notFound: 'Hotel not found.',
    loading: 'Loading...',
    amenities: 'Amenities',
    from: 'From',
    contact: 'Contact',
    address: 'Address',
    bookNow: 'Book',
    menuLink: 'Restaurant / Menu',
  },
}

export default function HotelLandingPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const [lang, setLang] = useState(i18n.language || 'me')
  const isEn = lang === 'en'
  const t = isEn ? T.en : T.me

  const [hotel, setHotel] = useState(null)
  const [roomTypes, setRoomTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: rest, error } = await supabase
        .from('restaurants')
        .select('*')
        .ilike('slug', slug)
        .single()

      if (error || !rest) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setHotel(rest)

      const { data: types } = await supabase
        .from('room_types')
        .select('id, name, description, max_occupancy, base_price, amenities, images')
        .eq('restaurant_id', rest.id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      setRoomTypes(types ?? [])
      setLoading(false)
    }
    load()
  }, [slug])

  useEffect(() => {
    const onLangChange = (lng) => setLang(lng)
    i18n.on('languageChanged', onLangChange)
    return () => i18n.off('languageChanged', onLangChange)
  }, [i18n])

  if (loading) {
    return (
      <div className={styles.loadWrap}>
        <div className={styles.spinner} />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className={styles.loadWrap}>
        <p className={styles.notFound}>{t.notFound}</p>
      </div>
    )
  }

  const amenitiesArr = (amenities) => {
    if (!amenities) return []
    if (Array.isArray(amenities)) return amenities
    if (typeof amenities === 'object') return Object.values(amenities)
    return []
  }

  const firstImage = (images) => {
    if (!images) return null
    if (Array.isArray(images) && images.length > 0) return images[0]
    if (typeof images === 'object') {
      const vals = Object.values(images)
      if (vals.length > 0) return vals[0]
    }
    return null
  }

  return (
    <div className={styles.page}>
      {/* ── Hero ── */}
      <div className={styles.hero}>
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <div className={styles.langRow}>
            <LanguageSwitcher variant="dark" />
          </div>
          {hotel.logo_url && (
            <img src={hotel.logo_url} alt={hotel.name} className={styles.logo} />
          )}
          <h1 className={styles.hotelName}>{hotel.name}</h1>
          {hotel.description && (
            <p className={styles.hotelDesc}>{hotel.description}</p>
          )}
        </div>
      </div>

      {/* ── CTAs ── */}
      <div className={styles.ctaSection}>
        <button
          className={styles.ctaPrimary}
          onClick={() => navigate(`/${slug}/book`)}
        >
          🛏️ {t.book}
        </button>
        <button
          className={styles.ctaSecondary}
          onClick={() => navigate(`/${slug}/guest`)}
        >
          <span className={styles.ctaSecLabel}>🔑 {t.guestApp}</span>
          <span className={styles.ctaSecSub}>{t.guestAppSub}</span>
        </button>
      </div>

      {/* ── Room types ── */}
      {roomTypes.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.rooms}</h2>
          <div className={styles.roomGrid}>
            {roomTypes.map(rt => {
              const img = firstImage(rt.images)
              const amenities = amenitiesArr(rt.amenities).slice(0, 5)
              return (
                <div key={rt.id} className={styles.roomCard}>
                  {img ? (
                    <img src={img} alt={rt.name} className={styles.roomImg} />
                  ) : (
                    <div className={styles.roomImgPlaceholder}>🏨</div>
                  )}
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
                    {rt.max_occupancy && (
                      <div className={styles.roomOccupancy}>
                        👤 max {rt.max_occupancy} {t.guests}
                      </div>
                    )}
                    {rt.description && (
                      <p className={styles.roomDesc}>{rt.description}</p>
                    )}
                    {amenities.length > 0 && (
                      <div className={styles.amenities}>
                        {amenities.map((a, i) => (
                          <span key={i} className={styles.amenityTag}>{a}</span>
                        ))}
                      </div>
                    )}
                    <button
                      className={styles.roomBookBtn}
                      onClick={() => navigate(`/${slug}/book`)}
                    >
                      {t.bookNow} →
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Hotel info ── */}
      {(hotel.phone || hotel.address || hotel.email) && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.contact}</h2>
          <div className={styles.infoCard}>
            {hotel.phone && (
              <a href={`tel:${hotel.phone}`} className={styles.infoRow}>
                <span className={styles.infoIcon}>📞</span>
                <span>{hotel.phone}</span>
              </a>
            )}
            {hotel.email && (
              <a href={`mailto:${hotel.email}`} className={styles.infoRow}>
                <span className={styles.infoIcon}>✉️</span>
                <span>{hotel.email}</span>
              </a>
            )}
            {hotel.address && (
              <div className={styles.infoRow}>
                <span className={styles.infoIcon}>📍</span>
                <span>{hotel.address}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Menu link ── */}
      <div className={styles.menuLink}>
        <button
          className={styles.menuLinkBtn}
          onClick={() => navigate(`/${slug}`)}
        >
          🍽️ {t.menuLink}
        </button>
      </div>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <p>Powered by <strong>SmartMeni</strong></p>
      </footer>
    </div>
  )
}
