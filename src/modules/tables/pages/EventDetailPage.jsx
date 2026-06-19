import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import { getSeatPositions } from '../../../lib/seatLayout'
import styles from './EventDetailPage.module.css'

const EMPTY_GUEST = { first_name: '', last_name: '', party_size: 1, notes: '' }
const STATUSES = ['draft', 'confirmed', 'completed', 'cancelled']

export default function EventDetailPage() {
  const { id } = useParams()
  const { restaurant, hasPermission } = usePlatform()
  const navigate = useNavigate()
  const { t } = useTranslation('admin')

  const [event, setEvent] = useState(null)
  const [tables, setTables] = useState([])
  const [guests, setGuests] = useState([])
  const [selectedTable, setSelectedTable] = useState(null)
  const [newGuest, setNewGuest] = useState(EMPTY_GUEST)
  const [loading, setLoading] = useState(true)

  const restaurantId = restaurant?.id
  const canManage = hasPermission('manage_tables')

  useEffect(() => {
    if (!restaurantId || !id) return
    let cancelled = false
    ;(async () => {
      const { data: ev } = await supabase.from('events').select('*')
        .eq('id', id).eq('restaurant_id', restaurantId).single()
      if (cancelled) return
      setEvent(ev || null)
      const [{ data: tbls }, { data: gs }] = await Promise.all([
        ev?.layout_id
          ? supabase.from('tables').select('id, number, label, x, y, width, height, shape, seats')
              .eq('restaurant_id', restaurantId).eq('layout_id', ev.layout_id).order('number')
          : Promise.resolve({ data: [] }),
        supabase.from('event_guests').select('*').eq('event_id', id).order('created_at'),
      ])
      if (cancelled) return
      setTables(tbls || [])
      setGuests(gs || [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [restaurantId, id])

  const guestsAt = (tableId) => guests.filter(g => g.table_id === tableId)
  const unseated = guests.filter(g => !g.table_id)
  const guestName = (g) => [g.first_name, g.last_name].filter(Boolean).join(' ').trim() || t('edGuestNoName')

  const addGuest = async () => {
    if (!newGuest.first_name.trim() && !newGuest.last_name.trim()) return
    const row = {
      event_id: id, restaurant_id: restaurantId,
      table_id: selectedTable || null,
      first_name: newGuest.first_name.trim() || null,
      last_name: newGuest.last_name.trim() || null,
      party_size: parseInt(newGuest.party_size) || 1,
      notes: newGuest.notes.trim() || null,
    }
    const { data } = await supabase.from('event_guests').insert(row).select('*').single()
    if (data) setGuests(prev => [...prev, data])
    setNewGuest(EMPTY_GUEST)
  }

  const patchGuest = async (guestId, patch) => {
    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, ...patch } : g))
    await supabase.from('event_guests').update(patch).eq('id', guestId)
  }
  const setGuestLocal = (guestId, patch) =>
    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, ...patch } : g))

  const removeGuest = async (guestId) => {
    setGuests(prev => prev.filter(g => g.id !== guestId))
    await supabase.from('event_guests').delete().eq('id', guestId)
  }

  const patchEvent = async (patch) => {
    setEvent(prev => ({ ...prev, ...patch }))
    await supabase.from('events').update(patch).eq('id', id)
  }

  const deleteEvent = async () => {
    if (!confirm(t('edDeleteConfirm', { name: event.name }))) return
    await supabase.from('events').delete().eq('id', id)
    navigate('/admin/tables/events')
  }

  if (loading) return <div className={styles.empty}>{t('evLoading')}</div>
  if (!event) return <div className={styles.empty}>{t('edNotFound')}</div>

  const selTbl = tables.find(tb => tb.id === selectedTable)

  // Form za dodavanje gosta (u selektovani sto ili nerasjeđene)
  const addForm = canManage && (
    <div className={styles.addForm}>
      <div className={styles.addRow}>
        <input className={styles.addInput} placeholder={t('edFirstName')} value={newGuest.first_name}
          onChange={e => setNewGuest(g => ({ ...g, first_name: e.target.value }))} />
        <input className={styles.addInput} placeholder={t('edLastName')} value={newGuest.last_name}
          onChange={e => setNewGuest(g => ({ ...g, last_name: e.target.value }))} />
        <input className={styles.addSize} type="number" min="1" title={t('edPartySize')} value={newGuest.party_size}
          onChange={e => setNewGuest(g => ({ ...g, party_size: e.target.value }))} />
      </div>
      <input className={styles.addInput} placeholder={t('edNotePlaceholder')} value={newGuest.notes}
        onChange={e => setNewGuest(g => ({ ...g, notes: e.target.value }))} />
      <button className={styles.btnAdd} onClick={addGuest}>
        + {selTbl ? t('edAddToTable', { table: selTbl.label || `${t('anaTable')} ${selTbl.number}` }) : t('edAddUnseated')}
      </button>
    </div>
  )

  const guestRow = (g, seated) => (
    <div key={g.id} className={styles.guestRow}>
      <div className={styles.guestHead}>
        <span className={styles.guestName}>{guestName(g)}{g.party_size > 1 ? ` ·${g.party_size}` : ''}</span>
        {canManage && (
          <div className={styles.guestActions}>
            {seated
              ? <button className={styles.miniBtn} onClick={() => patchGuest(g.id, { table_id: null })}>{t('edUnseat')}</button>
              : <button className={styles.miniBtn} disabled={!selTbl}
                  onClick={() => patchGuest(g.id, { table_id: selectedTable })}>{t('edSeatHere')}</button>}
            <button className={styles.miniBtnDanger} onClick={() => removeGuest(g.id)}>✕</button>
          </div>
        )}
      </div>
      <input
        className={styles.guestNote}
        placeholder={t('edNotePlaceholder')}
        value={g.notes || ''}
        disabled={!canManage}
        onChange={e => setGuestLocal(g.id, { notes: e.target.value })}
        onBlur={e => patchGuest(g.id, { notes: e.target.value.trim() || null })}
      />
    </div>
  )

  return (
    <div className={styles.wrap}>
      <div className={styles.topbar}>
        <button className={styles.btnBack} onClick={() => navigate('/admin/tables/events')}>← {t('edBack')}</button>
        {canManage && <button className={styles.btnDelete} onClick={deleteEvent}>🗑 {t('edDeleteEvent')}</button>}
      </div>

      {/* Event meta */}
      <div className={styles.meta}>
        <h1 className={styles.eventName}>{event.name}</h1>
        <div className={styles.metaRow}>
          <span className={styles.metaItem}>📅 {new Date(event.date + 'T00:00:00').toLocaleDateString()}</span>
          <label className={styles.metaItem}>
            {t('edStatus')}:&nbsp;
            <select value={event.status} disabled={!canManage}
              onChange={e => patchEvent({ status: e.target.value })}>
              {STATUSES.map(s => <option key={s} value={s}>{t(`evStatus_${s}`)}</option>)}
            </select>
          </label>
          <span className={styles.metaItem}>
            👥 {guests.length} / {event.expected_guests || '—'}
          </span>
        </div>
        <textarea
          className={styles.eventNotes}
          placeholder={t('edEventNotes')}
          defaultValue={event.notes || ''}
          disabled={!canManage}
          onBlur={e => patchEvent({ notes: e.target.value.trim() || null })}
        />
      </div>

      <div className={styles.layout}>
        {/* Canvas (read-only) */}
        <div className={styles.mapWrap}>
          {tables.length === 0 ? (
            <div className={styles.empty}>{t('edNoLayout')}</div>
          ) : (
            <div className={styles.mapCanvas}>
              {tables.map(tb => {
                const seated = guestsAt(tb.id)
                const count = seated.reduce((s, g) => s + (g.party_size || 1), 0)
                const full = count >= tb.seats
                return (
                  <div key={tb.id} className={styles.tableWrap}
                    style={{ left: tb.x, top: tb.y, width: tb.width, height: tb.height }}>
                    {getSeatPositions(tb.shape, tb.width, tb.height, tb.seats).map((p, i) => (
                      <div key={i} className={styles.seat} style={{ left: p.x, top: p.y }} />
                    ))}
                    <div
                      className={`${styles.tableEl} ${selectedTable === tb.id ? styles.tableElSelected : ''} ${full ? styles.tableElFull : ''}`}
                      style={{ borderRadius: tb.shape === 'circle' ? '50%' : 8 }}
                      onClick={() => setSelectedTable(tb.id === selectedTable ? null : tb.id)}
                    >
                      <div className={styles.tableLabel}>{tb.label || `${t('anaTable')} ${tb.number}`}</div>
                      <div className={styles.tableCount}>{count}/{tb.seats}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className={styles.panel}>
          {selTbl ? (
            <>
              <div className={styles.panelTitle}>
                {selTbl.label || `${t('anaTable')} ${selTbl.number}`}
                <span className={styles.panelSub}>{guestsAt(selTbl.id).reduce((s, g) => s + (g.party_size || 1), 0)}/{selTbl.seats}</span>
              </div>
              {addForm}
              <div className={styles.guestList}>
                {guestsAt(selTbl.id).length === 0
                  ? <div className={styles.panelHint}>{t('edTableEmpty')}</div>
                  : guestsAt(selTbl.id).map(g => guestRow(g, true))}
              </div>
            </>
          ) : (
            <>
              <div className={styles.panelTitle}>{t('edUnseated')}<span className={styles.panelSub}>{unseated.length}</span></div>
              {addForm}
              <div className={styles.panelHint}>{t('edSelectTableHint')}</div>
              <div className={styles.guestList}>
                {unseated.map(g => guestRow(g, false))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
