import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import styles from './FolioPrint.module.css'

const TYPE_LABEL = {
  room_charge: 'Noćenje',
  restaurant:  'Restoran',
  minibar:     'Minibar',
  spa:         'Spa',
  other:       'Ostalo',
}

export default function FolioPrint() {
  const { id } = useParams()
  const { restaurant } = usePlatform()
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

  if (loading) return <div className={styles.loading}>Učitavanje...</div>
  if (!data?.folio) return <div className={styles.loading}>Folio nije pronađen.</div>

  const { res, folio, items } = data
  const computedTotal = items.reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0)
  const paidAmount    = parseFloat(folio.paid_amount || 0)
  const balance       = computedTotal - paidAmount

  const invoiceNum = `FOL-${folio.id.slice(-8).toUpperCase()}`
  const printDate  = new Date().toLocaleDateString('sr-Latn', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className={styles.page}>
      <div className={styles.printActions}>
        <button className={styles.printBtn} onClick={() => window.print()}>🖨️ Štampaj / Sačuvaj PDF</button>
        <button className={styles.closeBtn} onClick={() => window.close()}>✕ Zatvori</button>
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
            <h2 className={styles.invoiceTitle}>RAČUN</h2>
            <table className={styles.metaTable}>
              <tbody>
                <tr><td>Broj:</td>  <td><strong>{invoiceNum}</strong></td></tr>
                {(folio.label || !folio.is_primary) && (
                  <tr><td>Folio:</td> <td>{folio.label || 'Folio'}</td></tr>
                )}
                <tr><td>Datum:</td> <td>{printDate}</td></tr>
                <tr>
                  <td>Status:</td>
                  <td>
                    <strong className={balance <= 0 ? styles.paid : styles.due}>
                      {balance <= 0 ? 'PLAĆENO' : 'DUGUJE'}
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
            <p className={styles.sectionLabel}>GOST</p>
            <p className={styles.guestName}>{res?.guest_name}</p>
          </div>
          <div>
            <p className={styles.sectionLabel}>SMJEŠTAJ</p>
            <p>{res?.rooms?.room_number ? `Soba ${res.rooms.room_number}` : res?.room_types?.name ?? '—'}</p>
            {res?.check_in_date  && <p>Check-in: {new Date(res.check_in_date).toLocaleDateString('sr-Latn')}</p>}
            {res?.check_out_date && <p>Check-out: {new Date(res.check_out_date).toLocaleDateString('sr-Latn')}</p>}
          </div>
          <div>
            <p className={styles.sectionLabel}>GOSTI</p>
            <p>{res?.adults} odrasli{res?.children ? `, ${res.children} djece` : ''}</p>
          </div>
        </div>

        <hr className={styles.divider} />

        {/* Items */}
        <table className={styles.itemsTable}>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Kategorija</th>
              <th>Opis</th>
              <th className={styles.right}>Kom</th>
              <th className={styles.right}>Jed. cijena</th>
              <th className={styles.right}>Iznos</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} className={styles.emptyRow}>Nema stavki.</td></tr>
            )}
            {items.map(item => (
              <tr key={item.id}>
                <td>
                  {item.date
                    ? new Date(item.date).toLocaleDateString('sr-Latn', { day: '2-digit', month: '2-digit' })
                    : '—'}
                </td>
                <td>{TYPE_LABEL[item.type] ?? item.type}</td>
                <td>{item.description}</td>
                <td className={styles.right}>{item.quantity}</td>
                <td className={styles.right}>€{parseFloat(item.unit_price).toFixed(2)}</td>
                <td className={styles.right}>€{parseFloat(item.total_price).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={styles.totalRow}>
              <td colSpan={5} className={styles.right}><strong>Ukupno</strong></td>
              <td className={styles.right}><strong>€{computedTotal.toFixed(2)}</strong></td>
            </tr>
            <tr>
              <td colSpan={5} className={styles.right}>Plaćeno</td>
              <td className={styles.right}>€{paidAmount.toFixed(2)}</td>
            </tr>
            {balance > 0 && (
              <tr className={styles.balanceDue}>
                <td colSpan={5} className={styles.right}><strong>Duguje</strong></td>
                <td className={styles.right}><strong>€{balance.toFixed(2)}</strong></td>
              </tr>
            )}
            {balance < 0 && (
              <tr className={styles.balancePaid}>
                <td colSpan={5} className={styles.right}><strong>Povrat</strong></td>
                <td className={styles.right}><strong>€{Math.abs(balance).toFixed(2)}</strong></td>
              </tr>
            )}
          </tfoot>
        </table>

        <div className={styles.footer}>
          <p>Hvala na posjeti! &bull; {restaurant?.name}</p>
        </div>
      </div>
    </div>
  )
}
