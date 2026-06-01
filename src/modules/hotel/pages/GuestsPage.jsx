import { useState } from 'react'
import { usePlatform } from '../../../context/PlatformContext'
import { useGuests } from '../hooks/useGuests'
import { supabase } from '../../../lib/supabase'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import styles from './Hotel.module.css'
import g from './GuestsPage.module.css'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('sr-Latn', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getLastStay(reservations) {
  if (!reservations?.length) return null
  const dates = reservations.map(r => r.check_out_date).filter(Boolean).sort()
  return dates[dates.length - 1] ?? null
}

export default function GuestsPage() {
  const { restaurant } = usePlatform()
  const [search, setSearch] = useState('')
  const { guests, loading, refetch } = useGuests(restaurant?.id, search)

  const [expandedId, setExpandedId] = useState(null)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)

  const handleExpand = (guest) => {
    if (expandedId === guest.id) {
      setExpandedId(null)
      setEditData({})
      return
    }
    setExpandedId(guest.id)
    setEditData({
      name: guest.name ?? '',
      phone: guest.phone ?? '',
      nationality: guest.nationality ?? '',
      date_of_birth: guest.date_of_birth ?? '',
      document_number: guest.document_number ?? '',
      notes: guest.notes ?? '',
      vip_status: guest.vip_status ?? false,
    })
  }

  const handleSave = async (guestId) => {
    setSaving(true)
    const { error } = await supabase
      .from('guests')
      .update({
        name: editData.name || null,
        phone: editData.phone || null,
        nationality: editData.nationality || null,
        date_of_birth: editData.date_of_birth || null,
        document_number: editData.document_number || null,
        notes: editData.notes || null,
        vip_status: editData.vip_status,
      })
      .eq('id', guestId)
    setSaving(false)
    if (error) return toast.error('Greška pri čuvanju: ' + error.message)
    toast.success('Podaci gosta sačuvani')
    setExpandedId(null)
    setEditData({})
    refetch()
  }

  if (loading) return <LoadingSpinner fullPage />

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Gosti</h1>
          <p className={styles.subtitle}>CRM — pregled i upravljanje profilima gostiju</p>
        </div>
      </div>

      <input
        className={g.searchBar}
        type="search"
        placeholder="Pretraži po imenu ili e-mailu..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {guests.length === 0 ? (
        <div className={g.emptyState}>
          <div className={g.emptyIcon}>👤</div>
          <p>{search ? 'Nema gostiju koji odgovaraju pretrazi.' : 'Nema evidentiranih gostiju. Gosti se automatski dodaju pri prvoj rezervaciji.'}</p>
        </div>
      ) : (
        <div className={g.guestList}>
          {guests.map(guest => {
            const isExpanded = expandedId === guest.id
            const stayCount = guest.hotel_reservations?.length ?? 0
            const lastStay = getLastStay(guest.hotel_reservations)

            return (
              <div
                key={guest.id}
                className={`${g.guestCard} ${isExpanded ? g.guestCardExpanded : ''}`}
              >
                <div className={g.guestCardTop} onClick={() => handleExpand(guest)}>
                  <div className={g.guestCardLeft}>
                    <div className={g.guestNameRow}>
                      <span className={g.guestName}>{guest.name || guest.email || '—'}</span>
                      {guest.vip_status && <span className={g.vipBadge}>VIP</span>}
                    </div>
                    <div className={g.guestMeta}>
                      {guest.email && <span>{guest.email}</span>}
                      {guest.phone && <span>· {guest.phone}</span>}
                      {guest.nationality && <span>· {guest.nationality}</span>}
                    </div>
                  </div>
                  <div className={g.guestCardRight}>
                    <span className={g.stayCount}>{stayCount} {stayCount === 1 ? 'boravak' : 'boravaka'}</span>
                    {lastStay && <span className={g.lastStay}>Zadnji: {formatDate(lastStay)}</span>}
                  </div>
                </div>

                {isExpanded && (
                  <div className={g.editForm} onClick={e => e.stopPropagation()}>
                    <div className={g.editFormGrid}>
                      <div className={g.editField}>
                        <label>Ime i prezime</label>
                        <input
                          value={editData.name}
                          onChange={e => setEditData(p => ({ ...p, name: e.target.value }))}
                          placeholder="Marko Marković"
                        />
                      </div>
                      <div className={g.editField}>
                        <label>Telefon</label>
                        <input
                          value={editData.phone}
                          onChange={e => setEditData(p => ({ ...p, phone: e.target.value }))}
                          placeholder="+382 67 000 000"
                        />
                      </div>
                      <div className={g.editField}>
                        <label>Nacionalnost</label>
                        <input
                          value={editData.nationality}
                          onChange={e => setEditData(p => ({ ...p, nationality: e.target.value }))}
                          placeholder="Crna Gora"
                        />
                      </div>
                      <div className={g.editField}>
                        <label>Datum rođenja</label>
                        <input
                          type="date"
                          value={editData.date_of_birth}
                          onChange={e => setEditData(p => ({ ...p, date_of_birth: e.target.value }))}
                        />
                      </div>
                      <div className={g.editField}>
                        <label>Broj dokumenta</label>
                        <input
                          value={editData.document_number}
                          onChange={e => setEditData(p => ({ ...p, document_number: e.target.value }))}
                          placeholder="Pasoš / LK"
                        />
                      </div>
                      <div className={`${g.editField} ${g.editFieldFull}`}>
                        <label>Napomene</label>
                        <textarea
                          rows={2}
                          value={editData.notes}
                          onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))}
                          placeholder="Interne napomene o gostu..."
                        />
                      </div>
                    </div>
                    <label className={g.vipToggleRow}>
                      <input
                        type="checkbox"
                        checked={editData.vip_status}
                        onChange={e => setEditData(p => ({ ...p, vip_status: e.target.checked }))}
                      />
                      VIP gost
                    </label>
                    <div className={g.editActions}>
                      <button className={g.btnCancel} onClick={() => { setExpandedId(null); setEditData({}) }}>
                        Odustani
                      </button>
                      <button className={g.btnSave} onClick={() => handleSave(guest.id)} disabled={saving}>
                        {saving ? 'Čuvanje...' : 'Sačuvaj'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
