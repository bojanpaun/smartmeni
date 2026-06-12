import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../../context/PlatformContext'
import { useGuests } from '../hooks/useGuests'
import { supabase } from '../../../lib/supabase'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import styles from './Hotel.module.css'
import g from './GuestsPage.module.css'

function formatDate(d, dl) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(dl, { day: '2-digit', month: 'short', year: 'numeric' })
}

function getLastStay(reservations) {
  if (!reservations?.length) return null
  const dates = reservations.map(r => r.check_out_date).filter(Boolean).sort()
  return dates[dates.length - 1] ?? null
}

export default function GuestsPage() {
  const { restaurant } = usePlatform()
  const { t, i18n } = useTranslation('admin')
  const dl = i18n.language === 'en' ? 'en-US' : 'sr-Latn'
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
    if (error) return toast.error(t('htSaveErr') + ': ' + error.message)
    toast.success(t('htGuestSaved'))
    setExpandedId(null)
    setEditData({})
    refetch()
  }

  if (loading) return <LoadingSpinner fullPage />

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('htNavGuests')}</h1>
          <p className={styles.subtitle}>{t('htGuestsCrmSub')}</p>
        </div>
      </div>

      <input
        className={g.searchBar}
        type="search"
        placeholder={t('htSearchNameEmail')}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {guests.length === 0 ? (
        <div className={g.emptyState}>
          <div className={g.emptyIcon}>👤</div>
          <p>{search ? t('htNoGuestsSearch') : t('htNoGuests')}</p>
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
                    <span className={g.stayCount}>{stayCount} {stayCount === 1 ? t('htStayOne') : t('htStayOther')}</span>
                    {lastStay && <span className={g.lastStay}>{t('htLastStay')}: {formatDate(lastStay, dl)}</span>}
                  </div>
                </div>

                {isExpanded && (
                  <div className={g.editForm} onClick={e => e.stopPropagation()}>
                    <div className={g.editFormGrid}>
                      <div className={g.editField}>
                        <label>{t('htFullName')}</label>
                        <input
                          value={editData.name}
                          onChange={e => setEditData(p => ({ ...p, name: e.target.value }))}
                          placeholder="Marko Marković"
                        />
                      </div>
                      <div className={g.editField}>
                        <label>{t('htPhone')}</label>
                        <input
                          value={editData.phone}
                          onChange={e => setEditData(p => ({ ...p, phone: e.target.value }))}
                          placeholder="+382 67 000 000"
                        />
                      </div>
                      <div className={g.editField}>
                        <label>{t('htNationality')}</label>
                        <input
                          value={editData.nationality}
                          onChange={e => setEditData(p => ({ ...p, nationality: e.target.value }))}
                          placeholder="Crna Gora"
                        />
                      </div>
                      <div className={g.editField}>
                        <label>{t('htDateOfBirth')}</label>
                        <input
                          type="date"
                          value={editData.date_of_birth}
                          onChange={e => setEditData(p => ({ ...p, date_of_birth: e.target.value }))}
                        />
                      </div>
                      <div className={g.editField}>
                        <label>{t('htDocNumber')}</label>
                        <input
                          value={editData.document_number}
                          onChange={e => setEditData(p => ({ ...p, document_number: e.target.value }))}
                          placeholder="Pasoš / LK"
                        />
                      </div>
                      <div className={`${g.editField} ${g.editFieldFull}`}>
                        <label>{t('htNotes')}</label>
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
                      {t('htVipGuest')}
                    </label>
                    <div className={g.editActions}>
                      <button className={g.btnCancel} onClick={() => { setExpandedId(null); setEditData({}) }}>
                        {t('cancel')}
                      </button>
                      <button className={g.btnSave} onClick={() => handleSave(guest.id)} disabled={saving}>
                        {saving ? t('saving') : t('save')}
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
