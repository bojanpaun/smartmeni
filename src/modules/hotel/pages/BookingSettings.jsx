import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import styles from './Hotel.module.css'
import bs from './BookingSettings.module.css'

export default function BookingSettings() {
  const { restaurant, setRestaurant } = usePlatform()
  const { t } = useTranslation('admin')
  const printRef = useRef(null)

  const [form, setForm] = useState(restaurant ? {
    show_booking_button:   restaurant.show_booking_button  ?? false,
    booking_page_title:    restaurant.booking_page_title   ?? '',
    booking_page_desc:     restaurant.booking_page_desc    ?? '',
    booking_checkin_time:  restaurant.booking_checkin_time ?? '14:00',
    booking_checkout_time: restaurant.booking_checkout_time ?? '11:00',
    booking_custom_domain: restaurant.booking_custom_domain ?? '',
    booking_mode:          restaurant.booking_mode          ?? 'immediate',
    early_departure_charge: restaurant.early_departure_charge ?? 'stay',
  } : null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!restaurant || !form) return <LoadingSpinner fullPage />

  const bookingUrl = form.booking_custom_domain
    ? `https://${form.booking_custom_domain}`
    : `${window.location.origin}/${restaurant.slug}/book`

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&format=png&data=${encodeURIComponent(bookingUrl)}`

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase.from('restaurants').update(form).eq('id', restaurant.id)
    if (error) { toast.error(t('htSaveErr')); setSaving(false); return }
    setRestaurant(r => ({ ...r, ...form }))
    setSaving(false)
    toast.success(t('htSettingsSaved'))
  }

  const copyUrl = () => {
    navigator.clipboard.writeText(bookingUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePrint = () => {
    const win = window.open('', '_blank')
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${t('htBookingQrTitle', { name: restaurant.name })}</title>
        <style>
          body { margin: 0; background: #fff; font-family: 'DM Sans', sans-serif; }
          .page {
            width: 180mm; margin: 0 auto; padding: 20mm;
            display: flex; flex-direction: column; align-items: center;
            text-align: center;
          }
          .hotel { font-size: 20pt; font-weight: 700; color: #0e1a14; margin-bottom: 4mm; }
          .sub { font-size: 11pt; color: #8a9e96; margin-bottom: 8mm; }
          .qr { width: 60mm; height: 60mm; margin-bottom: 8mm; }
          .url { font-size: 9pt; color: #3a4a42; word-break: break-all; }
          .cta { font-size: 14pt; font-weight: 700; color: #1a9e6e; margin-bottom: 4mm; margin-top: 6mm; }
          .times { font-size: 10pt; color: #8a9e96; margin-top: 6mm; border-top: 1px solid #eee; padding-top: 5mm; width: 100%; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="hotel">${restaurant.name}</div>
          <div class="sub">${form.booking_page_title || t('htOnlineBooking')}</div>
          <img class="qr" src="${qrSrc}&size=400x400" alt="QR" />
          <div class="cta">${t('htScanToBook')}</div>
          <div class="url">${bookingUrl}</div>
          <div class="times">${t('htCheckin')}: ${form.booking_checkin_time} &nbsp;·&nbsp; ${t('htCheckout')}: ${form.booking_checkout_time}</div>
        </div>
        <script>window.onload = () => { setTimeout(() => window.print(), 600) }<\/script>
      </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('htBookingSettingsTitle')}</h1>
          <p className={styles.subtitle}>{t('htBookingSettingsSub')}</p>
        </div>
        <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
          {saving ? t('saving') : t('save')}
        </button>
      </div>

      <div className={bs.grid}>
        {/* Lijeva kolona */}
        <div className={bs.col}>

          {/* Toggle */}
          <div className={bs.section}>
            <div className={bs.sectionTitle}>{t('htVisibility')}</div>
            <label className={bs.toggleRow}>
              <span className={`${bs.toggle} ${form.show_booking_button ? bs.toggleOn : bs.toggleOff}`}
                onClick={() => setForm(f => ({ ...f, show_booking_button: !f.show_booking_button }))} />
              <div>
                <div className={bs.toggleLabel}>{t('htShowFloatingBtn')}</div>
                <div className={bs.toggleHint}>{t('htShowFloatingHint')}</div>
              </div>
            </label>
          </div>

          {/* Booking stranica */}
          <div className={bs.section}>
            <div className={bs.sectionTitle}>{t('htBookingPage')}</div>
            <div className={bs.field}>
              <label>{t('htPageTitle')}</label>
              <input
                value={form.booking_page_title}
                onChange={e => setForm(f => ({ ...f, booking_page_title: e.target.value }))}
                placeholder={t('htBookingTitlePh', { name: restaurant.name })}
              />
            </div>
            <div className={bs.field}>
              <label>{t('htShortDesc')}</label>
              <textarea
                value={form.booking_page_desc}
                onChange={e => setForm(f => ({ ...f, booking_page_desc: e.target.value }))}
                placeholder="Rezervišite smještaj direktno bez posrednika..."
                rows={3}
                className={bs.textarea}
              />
            </div>
            <div className={bs.row2}>
              <div className={bs.field}>
                <label>{t('htCheckinDefault')}</label>
                <input type="time" value={form.booking_checkin_time}
                  onChange={e => setForm(f => ({ ...f, booking_checkin_time: e.target.value }))} />
              </div>
              <div className={bs.field}>
                <label>{t('htCheckoutDefault')}</label>
                <input type="time" value={form.booking_checkout_time}
                  onChange={e => setForm(f => ({ ...f, booking_checkout_time: e.target.value }))} />
              </div>
            </div>
            <div className={bs.field}>
              <label>{t('htEarlyDepartureCharge')}</label>
              <select value={form.early_departure_charge}
                onChange={e => setForm(f => ({ ...f, early_departure_charge: e.target.value }))}>
                <option value="stay">{t('htChargeStayed')}</option>
                <option value="full">{t('htChargeFull')}</option>
              </select>
              <div className={bs.toggleHint}>
                {t('htEarlyDepartureHint')}
              </div>
            </div>
          </div>

          {/* Mod potvrde rezervacije */}
          <div className={bs.section}>
            <div className={bs.sectionTitle}>{t('htConfirmMode')}</div>
            <div className={bs.modeCards}>
              {[
                { value: 'immediate', icon: '✅', labelKey: 'htModeImmediate', descKey: 'htModeImmediateD' },
                { value: 'manual',    icon: '📋', labelKey: 'htModeManual',    descKey: 'htModeManualD' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${bs.modeCard} ${form.booking_mode === opt.value ? bs.modeCardActive : ''}`}
                  onClick={() => setForm(f => ({ ...f, booking_mode: opt.value }))}
                >
                  <span className={bs.modeIcon}>{opt.icon}</span>
                  <span className={bs.modeLabel}>{t(opt.labelKey)}</span>
                  <span className={bs.modeDesc}>{t(opt.descKey)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom domena */}
          <div className={bs.section}>
            <div className={bs.sectionTitle}>{t('htCustomDomain')} <span className={bs.badge}>{t('htAdvanced')}</span></div>
            <div className={bs.field}>
              <label>{t('htDomainLabel')}</label>
              <input
                value={form.booking_custom_domain}
                onChange={e => setForm(f => ({ ...f, booking_custom_domain: e.target.value.replace(/^https?:\/\//, '') }))}
                placeholder="book.mojhotel.com"
              />
            </div>
            <div className={bs.infoBox}>
              <div className={bs.infoTitle}>{t('htDomainHowTo')}</div>
              <ol className={bs.infoList}>
                <li>{t('htDnsStep1')}</li>
                <li><code className={bs.code}>{form.booking_custom_domain || 'book.mojhotel.com'} → {window.location.host}</code></li>
                <li>{t('htDnsStep3')}</li>
              </ol>
            </div>
          </div>

          {/* Booking link */}
          <div className={bs.section}>
            <div className={bs.sectionTitle}>{t('htBookingLink')}</div>
            <div className={bs.urlRow}>
              <div className={bs.urlText}>{bookingUrl}</div>
              <button className={bs.btnCopy} onClick={copyUrl}>
                {copied ? `✓ ${t('htCopied')}` : t('htCopy')}
              </button>
            </div>
          </div>

        </div>

        {/* Desna kolona — QR */}
        <div className={bs.col}>
          <div className={bs.section}>
            <div className={bs.sectionTitle}>{t('htQrForReception')}</div>
            <div className={bs.qrWrap}>
              <img src={qrSrc} alt="Booking QR" className={bs.qrImg} />
              <div className={bs.qrHotelName}>{restaurant.name}</div>
              <div className={bs.qrCta}>{form.booking_page_title || t('htOnlineBooking')}</div>
              <div className={bs.qrTimes}>
                {t('htCheckin')}: {form.booking_checkin_time} &nbsp;·&nbsp; {t('htCheckout')}: {form.booking_checkout_time}
              </div>
            </div>
            <button className={`${styles.btnPrimary} ${bs.btnPrint}`} onClick={handlePrint}>
              🖨️ &nbsp;{t('htPrintQr')}
            </button>
            <p className={bs.printHint}>
              {t('htPrintHint')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
