import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import { useMoney } from '../../../lib/useMoney'
import styles from './FolioPrint.module.css'

const TYPE_LABEL_KEYS = {
  room_charge: 'fpTypeNight',
  restaurant:  'htTypeRestaurant',
  minibar:     'htTypeMinibar',
  spa:         'htTypeSpa',
  other:       'htTypeOther',
}

export default function FolioPrint() {
  const { id } = useParams()
  const { t, i18n } = useTranslation('admin')
  const dl = i18n.language === 'en' ? 'en-US' : 'sr-Latn'
  const { restaurant } = usePlatform()
  const money = useMoney()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const printed = useRef(false)

  useEffect(() => { load() }, [id])

  useEffect(() => {
    if (data && !printed.current) {
      printed.current = true
      setTimeout(() => window.print(), 400)
    }
  }, [data])

  const load = async () => {
    const wantedFolioId = new URLSearchParams(window.location.search).get('folio')
    const [{ data: res }, { data: folios }] = await Promise.all([
      supabase.from('hotel_reservations')
        .select('*, rooms(room_number), room_types(name)')
        .eq('id', id).single(),
      supabase.from('folios').select('*').eq('reservation_id', id)
        .order('is_primary', { ascending: false }).order('created_at', { ascending: true }),
    ])

    // Konkretan folio iz ?folio= ili primarni/prvi (split: štampa se po foliju)
    const folio = (folios ?? []).find(f => f.id === wantedFolioId) ?? (folios ?? [])[0] ?? null

    let items = []
    if (folio) {
      const { data: fi } = await supabase
        .from('folio_items').select('*')
        .eq('folio_id', folio.id)
        .order('created_at', { ascending: true })
      items = fi ?? []
    }

    setData({ res, folio, items })
    setLoading(false)
  }

  if (loading) return <div className={styles.loading}>{t('loading')}</div>
  if (!data?.folio) return <div className={styles.loading}>{t('fpFolioNotFound')}</div>

  const { res, folio, items } = data
  const computedTotal = items.reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0)
  const paidAmount    = parseFloat(folio.paid_amount || 0)
  const balance       = computedTotal - paidAmount

  const invoiceNum = `FOL-${folio.id.slice(-8).toUpperCase()}`
  const printDate  = new Date().toLocaleDateString(dl, { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className={styles.page}>
      <div className={styles.printActions}>
        <button className={styles.printBtn} onClick={() => window.print()}>🖨️ {t('fpPrintSave')}</button>
        <button className={styles.closeBtn} onClick={() => window.close()}>✕ {t('fpClose')}</button>
      </div>

      <div className={styles.invoice}>
        {/* Header */}
        <div className={styles.invoiceHeader}>
          <div className={styles.restaurantInfo}>
            {restaurant?.logo_url && (
              <img src={restaurant.logo_url} alt={restaurant.name} className={styles.logo} />
            )}
            <h1 className={styles.restaurantName}>{restaurant?.name}</h1>
            {restaurant?.address && <p className={styles.restaurantDetail}>{restaurant.address}</p>}
            {restaurant?.phone  && <p className={styles.restaurantDetail}>{restaurant.phone}</p>}
          </div>

          <div className={styles.invoiceMeta}>
            <h2 className={styles.invoiceTitle}>{t('fpInvoice')}</h2>
            <table className={styles.metaTable}>
              <tbody>
                <tr><td>{t('fpNumber')}:</td>  <td><strong>{invoiceNum}</strong></td></tr>
                {(folio.label || !folio.is_primary) && (
                  <tr><td>{t('htFolio')}:</td> <td>{folio.label || t('htFolio')}</td></tr>
                )}
                <tr><td>{t('htDateHead')}:</td> <td>{printDate}</td></tr>
                <tr>
                  <td>{t('htFieldStatus')}:</td>
                  <td>
                    <strong className={balance <= 0 ? styles.paid : styles.due}>
                      {balance <= 0 ? t('fpPaid') : t('fpDue')}
                    </strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <hr className={styles.divider} />

        {/* Guest + room info */}
        <div className={styles.guestSection}>
          <div>
            <p className={styles.sectionLabel}>{t('fpGuest')}</p>
            <p className={styles.guestName}>{res?.guest_name}</p>
          </div>
          <div>
            <p className={styles.sectionLabel}>{t('fpAccommodation')}</p>
            <p>{res?.rooms?.room_number ? t('htRoomNum', { num: res.rooms.room_number }) : res?.room_types?.name ?? '—'}</p>
            {res?.check_in_date  && <p>{t('htCheckin')}: {new Date(res.check_in_date).toLocaleDateString(dl)}</p>}
            {res?.check_out_date && <p>{t('htCheckout')}: {new Date(res.check_out_date).toLocaleDateString(dl)}</p>}
          </div>
          <div>
            <p className={styles.sectionLabel}>{t('fpGuests')}</p>
            <p>{t('fpAdults', { n: res?.adults })}{res?.children ? t('fpChildren', { n: res.children }) : ''}</p>
          </div>
        </div>

        <hr className={styles.divider} />

        {/* Items */}
        <table className={styles.itemsTable}>
          <thead>
            <tr>
              <th>{t('htDateHead')}</th>
              <th>{t('fpCategory')}</th>
              <th>{t('flDesc')}</th>
              <th className={styles.right}>{t('fpQtyShort')}</th>
              <th className={styles.right}>{t('fpUnitPrice')}</th>
              <th className={styles.right}>{t('htAmount')}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} className={styles.emptyRow}>{t('fpNoItems')}</td></tr>
            )}
            {items.map(item => (
              <tr key={item.id}>
                <td>
                  {item.date
                    ? new Date(item.date).toLocaleDateString(dl, { day: '2-digit', month: '2-digit' })
                    : '—'}
                </td>
                <td>{TYPE_LABEL_KEYS[item.type] ? t(TYPE_LABEL_KEYS[item.type]) : item.type}</td>
                <td>{item.description}</td>
                <td className={styles.right}>{item.quantity}</td>
                <td className={styles.right}>{money(item.unit_price)}</td>
                <td className={styles.right}>{money(item.total_price)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={styles.totalRow}>
              <td colSpan={5} className={styles.right}><strong>{t('flTotal')}</strong></td>
              <td className={styles.right}><strong>{money(computedTotal)}</strong></td>
            </tr>
            <tr>
              <td colSpan={5} className={styles.right}>{t('htPayPaid')}</td>
              <td className={styles.right}>{money(paidAmount)}</td>
            </tr>
            {balance > 0 && (
              <tr className={styles.balanceDue}>
                <td colSpan={5} className={styles.right}><strong>{t('fpOwes')}</strong></td>
                <td className={styles.right}><strong>{money(balance)}</strong></td>
              </tr>
            )}
            {balance < 0 && (
              <tr className={styles.balancePaid}>
                <td colSpan={5} className={styles.right}><strong>{t('fpRefundLabel')}</strong></td>
                <td className={styles.right}><strong>{money(Math.abs(balance))}</strong></td>
              </tr>
            )}
          </tfoot>
        </table>

        <div className={styles.footer}>
          <p>{t('fpThankYou')} &bull; {restaurant?.name}</p>
        </div>
      </div>
    </div>
  )
}
