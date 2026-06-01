import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlatform } from '../../../context/PlatformContext'
import { useSpaAppointments } from '../hooks/useSpaAppointments'
import DateNav, { DATE_TODAY } from '../../../components/shared/DateNav'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import styles from '../../hotel/pages/Hotel.module.css'
import spa from './Spa.module.css'

const STATUS_LABEL = {
  confirmed:  { label: 'Potvrđen',   color: '#2563eb', bg: '#dbeafe' },
  checked_in: { label: 'U toku',     color: '#0d7a52', bg: '#d1fae5' },
  completed:  { label: 'Završen',    color: '#6d28d9', bg: '#ede9fe' },
  cancelled:  { label: 'Otkazan',    color: '#9ca3af', bg: '#f3f4f6' },
  no_show:    { label: 'No-show',    color: '#c0392b', bg: '#fde0e0' },
}

const CATEGORY_ICON = {
  massage: '💆', facial: '✨', body: '🧖', nail: '💅',
  wellness: '🌿', group: '👥',
}

export default function SpaDashboard() {
  const { restaurant } = usePlatform()
  const navigate = useNavigate()
  const [from, setFrom] = useState(DATE_TODAY)
  const [to, setTo] = useState(DATE_TODAY)
  const [search, setSearch] = useState('')

  const { appointments, loading, updateStatus, cancel } = useSpaAppointments(restaurant?.id, from, to)

  if (!restaurant) return <LoadingSpinner fullPage />

  const filteredAppts = appointments.filter(a =>
    !search || (
      a.spa_services?.name?.toLowerCase().includes(search.toLowerCase()) ||
      (a.external_guest_name || '').toLowerCase().includes(search.toLowerCase())
    )
  )

  const confirmed  = appointments.filter(a => a.status === 'confirmed').length
  const inProgress = appointments.filter(a => a.status === 'checked_in').length
  const completed  = appointments.filter(a => a.status === 'completed').length
  const revenue    = appointments
    .filter(a => a.status === 'completed')
    .reduce((s, a) => s + Number(a.price), 0)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Spa &amp; Wellness</h1>
          <p className={styles.subtitle}>Termini, tretmani i terapeuti</p>
        </div>
        <div className={styles.headerActions}>
          {restaurant?.slug && (
            <a
              href={`/${restaurant.slug}/spa`}
              target="_blank"
              rel="noreferrer"
              className={styles.btnSecondary}
              title="Javna booking stranica za goste"
            >
              🌐 Spa stranica
            </a>
          )}
          <button className={styles.btnPrimary} onClick={() => navigate('/admin/spa/appointments')}>
            + Novi termin
          </button>
        </div>
      </div>

      <DateNav
        from={from}
        to={to}
        search={search}
        onChange={(f, t) => { setFrom(f); setTo(t) }}
        onSearch={setSearch}
        showFuture={true}
        placeholder="Pretraži gosta ili uslugu..."
      />

      {/* KPIs */}
      <div className={spa.kpiGrid}>
        <div className={spa.kpiCard}>
          <div className={spa.kpiLabel}>Potvrđeni</div>
          <div className={spa.kpiVal} style={{ color: '#2563eb' }}>{confirmed}</div>
        </div>
        <div className={spa.kpiCard}>
          <div className={spa.kpiLabel}>U toku</div>
          <div className={spa.kpiVal} style={{ color: '#0d7a52' }}>{inProgress}</div>
        </div>
        <div className={spa.kpiCard}>
          <div className={spa.kpiLabel}>Završeni</div>
          <div className={spa.kpiVal} style={{ color: '#6d28d9' }}>{completed}</div>
        </div>
        <div className={spa.kpiCard}>
          <div className={spa.kpiLabel}>Prihod danas</div>
          <div className={spa.kpiVal} style={{ color: '#0d7a52' }}>€{revenue.toFixed(2)}</div>
        </div>
      </div>

      {/* Quick nav */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: '📅 Kalendar', path: '/admin/spa/calendar' },
          { label: '🛎 Katalog tretmana', path: '/admin/spa/services' },
          { label: '👤 Terapeuti', path: '/admin/spa/therapists' },
          { label: '🚪 Kabine', path: '/admin/spa/rooms' },
          { label: '📊 Analitika', path: '/admin/spa/analytics' },
          { label: '⚙️ Postavke', path: '/admin/spa/settings' },
        ].map(item => (
          <button
            key={item.path}
            className={styles.btnSecondary}
            onClick={() => navigate(item.path)}
            style={{ fontSize: 13 }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Appointment list for selected date */}
      <div className={styles.sectionCard || ''} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--c-border)', fontWeight: 600, fontSize: 14 }}>
          Termini — {from === to
            ? new Date(from).toLocaleDateString('sr-Latn', { weekday: 'long', day: 'numeric', month: 'long' })
            : `${new Date(from).toLocaleDateString('sr-Latn', { day: 'numeric', month: 'long' })} — ${new Date(to).toLocaleDateString('sr-Latn', { day: 'numeric', month: 'long' })}`
          }
        </div>

        {loading ? <LoadingSpinner /> : filteredAppts.length === 0 ? (
          <div className={spa.empty}>
            <div className={spa.emptyIcon}>💆</div>
            <p>Nema termina za odabrani period{search ? ' i pretragu' : ''}.</p>
          </div>
        ) : (
          <table className={spa.table}>
            <thead>
              <tr>
                <th>Vrijeme</th>
                <th>Tretman</th>
                <th>Terapeut</th>
                <th>Kabina</th>
                <th>Gost</th>
                <th>Cijena</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredAppts.map(a => {
                const svc = a.spa_services
                const therapistName = a.spa_therapists?.staff
                  ? `${a.spa_therapists.staff.first_name} ${a.spa_therapists.staff.last_name}`
                  : '—'
                const guestName = a.external_guest_name || '(hotelski gost)'
                const sl = STATUS_LABEL[a.status] || STATUS_LABEL.confirmed
                return (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {a.start_time?.slice(0, 5)} – {a.end_time?.slice(0, 5)}
                    </td>
                    <td>
                      <span>{CATEGORY_ICON[svc?.category] || '💆'} </span>
                      {svc?.name}
                    </td>
                    <td>{therapistName}</td>
                    <td>{a.spa_rooms?.name || '—'}</td>
                    <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{guestName}</td>
                    <td style={{ fontWeight: 600 }}>€{Number(a.price).toFixed(2)}</td>
                    <td>
                      <span className={spa.badge} style={{ background: sl.bg, color: sl.color }}>{sl.label}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {a.status === 'confirmed' && (
                          <button className={styles.btnSmall || ''} style={{ padding: '4px 10px', fontSize: 12, background: 'var(--c-primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                            onClick={() => updateStatus(a.id, 'checked_in')}>
                            ▶ Počni
                          </button>
                        )}
                        {a.status === 'checked_in' && (
                          <button className={styles.btnSmall || ''} style={{ padding: '4px 10px', fontSize: 12, background: '#6d28d9', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                            onClick={() => updateStatus(a.id, 'completed')}>
                            ✓ Završi
                          </button>
                        )}
                        {(a.status === 'confirmed' || a.status === 'checked_in') && (
                          <button style={{ padding: '4px 10px', fontSize: 12, background: 'transparent', color: '#c0392b', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer' }}
                            onClick={() => cancel(a.id)}>
                            Otkaži
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
