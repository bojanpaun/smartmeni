import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import s from '../StaffPortal.module.css'

const TODAY = new Date().toISOString().slice(0, 10)

export default function HomeView({ staffId, restaurantId, staffInfo, brand }) {
  const { t, i18n } = useTranslation('staffportal')
  const dl = i18n.language === 'en' ? 'en-US' : dl
  const [schedule, setSchedule]           = useState(null)
  const [clockEntry, setClockEntry]       = useState(null)
  const [pendingCount, setPendingCount]   = useState(0)
  const [vacTotal, setVacTotal]           = useState(0)
  const [vacUsed, setVacUsed]             = useState(0)
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading]             = useState(true)
  const [clocking, setClocking]           = useState(false)
  const [elapsed, setElapsed]             = useState(null)
  const timerRef = useRef(null)

  // Zatvaranje obavijesti (po zaposlenom, lokalno na uređaju)
  const dkey = `staff_ann_dismissed_${staffId}`
  const [dismissed, setDismissed] = useState(() => new Set())
  useEffect(() => {
    if (!staffId) return
    try { setDismissed(new Set(JSON.parse(localStorage.getItem(`staff_ann_dismissed_${staffId}`) || '[]'))) } catch { /* ignore */ }
  }, [staffId])
  const dismissAnn = (id) => setDismissed(prev => {
    const n = new Set(prev); n.add(id)
    try { localStorage.setItem(dkey, JSON.stringify([...n])) } catch { /* ignore */ }
    return n
  })

  useEffect(() => { if (staffId) load() }, [staffId])

  const load = async () => {
    setLoading(true)
    const year = new Date().getFullYear()
    const now  = new Date().toISOString()
    const [
      { data: shifts },
      { data: entries },
      { data: vacAbsences },
      { data: staffData },
      { count: pending },
      { data: anns },
    ] = await Promise.all([
      supabase.from('work_schedules').select('*')
        .eq('staff_id', staffId).eq('date', TODAY).order('start_time'),
      supabase.from('attendance_entries').select('*')
        .eq('staff_id', staffId).eq('date', TODAY),
      supabase.from('staff_absences').select('days')
        .eq('staff_id', staffId).eq('absence_type', 'vacation').eq('approved', true)
        .gte('start_date', `${year}-01-01`).lte('end_date', `${year}-12-31`),
      supabase.from('staff').select('vacation_days_total').eq('id', staffId).single(),
      supabase.from('staff_absences').select('id', { count: 'exact', head: true })
        .eq('staff_id', staffId).is('approved', null),
      supabase.from('staff_announcements').select('*')
        .eq('restaurant_id', restaurantId)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('created_at', { ascending: false }),
    ])

    setSchedule(shifts?.[0] || null)
    setClockEntry(entries?.find(e => e.clock_in && !e.clock_out) || null)
    setVacTotal(staffData?.vacation_days_total || 0)
    setVacUsed((vacAbsences || []).reduce((s, a) => s + (a.days || 0), 0))
    setPendingCount(pending || 0)
    setAnnouncements(anns || [])
    setLoading(false)
  }

  // Live timer dok je zaposlenik "na poslu"
  useEffect(() => {
    if (clockEntry?.clock_in) {
      const tick = () => {
        const diff = Math.floor((Date.now() - new Date(clockEntry.clock_in)) / 1000)
        const h = Math.floor(diff / 3600)
        const m = Math.floor((diff % 3600) / 60)
        const sec = diff % 60
        setElapsed(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`)
      }
      tick()
      timerRef.current = setInterval(tick, 1000)
    } else {
      setElapsed(null)
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [clockEntry])

  const handleClockIn = async () => {
    setClocking(true)
    const { data } = await supabase.from('attendance_entries').insert({
      staff_id: staffId,
      restaurant_id: restaurantId,
      date: TODAY,
      clock_in: new Date().toISOString(),
    }).select().single()
    setClockEntry(data)
    setClocking(false)
  }

  const handleClockOut = async () => {
    if (!clockEntry) return
    setClocking(true)
    const now = new Date()
    const hoursWorked = ((now - new Date(clockEntry.clock_in)) / 3600000).toFixed(2)
    await supabase.from('attendance_entries').update({
      clock_out: now.toISOString(),
      hours_worked: hoursWorked,
    }).eq('id', clockEntry.id)
    setClockEntry(null)
    setClocking(false)
  }

  if (loading) return <div className={s.loadingInline}>{t('loading')}</div>

  const name = staffInfo?.first_name || staffInfo?.email?.split('@')[0] || ''
  const today = new Date().toLocaleDateString(dl, { weekday: 'long', day: 'numeric', month: 'long' })
  const isWorking = !!clockEntry
  const vacRemaining = Math.max(0, vacTotal - vacUsed)
  const vacPct = vacTotal > 0 ? Math.min(100, (vacUsed / vacTotal) * 100) : 0

  return (
    <div>
      {/* Obavijesti (zatvorene se skrivaju; sve su dostupne u tabu Profil) */}
      {announcements.filter(a => !dismissed.has(a.id)).map(ann => (
        <div key={ann.id} className={s.announcementCard} style={{ position: 'relative' }}>
          <button onClick={() => dismissAnn(ann.id)} title={t('close')}
            style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', fontSize: 16, lineHeight: 1, color: 'var(--c-text-muted)', cursor: 'pointer' }}>✕</button>
          <div className={s.announcementTitle} style={{ paddingRight: 20 }}>📢 {ann.title}</div>
          {ann.body && <div className={s.announcementBody}>{ann.body}</div>}
          <div className={s.announcementDate}>
            {new Date(ann.created_at).toLocaleDateString(dl, { day: 'numeric', month: 'long' })}
            {ann.edited_at && ` · ${t('edited')}`}
          </div>
        </div>
      ))}

      {/* Pozdrav */}
      <div className={s.homeGreeting}>
        <div className={s.homeGreetText}>{t('greeting')}{name ? `, ${name}` : ''}!</div>
        <div className={s.homeDate}>{today}</div>
      </div>

      {/* Clock in/out kartica */}
      <div className={s.clockCard}>
        {isWorking ? (
          <>
            <div className={s.clockStatus}>
              <div className={s.clockDot} style={{ background: '#16a34a' }} />
              <span className={s.clockStatusText}>{t('working')}</span>
            </div>
            <div className={s.clockTimer}>{elapsed}</div>
            <div className={s.clockSince}>
              {t('since')} {new Date(clockEntry.clock_in).toLocaleTimeString(dl, { hour: '2-digit', minute: '2-digit' })}
            </div>
            <button
              className={s.clockBtnOut}
              onClick={handleClockOut}
              disabled={clocking}
            >
              {clocking ? t('saving') : `⬆ ${t('clockOut')}`}
            </button>
          </>
        ) : (
          <>
            <div className={s.clockStatus}>
              <div className={s.clockDot} style={{ background: '#d1d5db' }} />
              <span className={s.clockStatusText}>{t('notClockedIn')}</span>
            </div>
            <button
              className={s.clockBtnIn}
              style={{ background: brand }}
              onClick={handleClockIn}
              disabled={clocking}
            >
              {clocking ? t('saving') : `⬇ ${t('clockIn')}`}
            </button>
          </>
        )}
      </div>

      {/* Smjena danas */}
      <div className={s.card}>
        <div className={s.cardTitle}>{t('shiftToday')}</div>
        {schedule ? (
          <div className={s.shiftRow} style={{ borderBottom: 'none', padding: '4px 0 0' }}>
            <div className={s.shiftDay}>
              {new Date(schedule.date + 'T00:00').toLocaleDateString(dl, { weekday: 'long' })}
              {schedule.note && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{schedule.note}</div>}
            </div>
            <div className={s.shiftTime}>{schedule.start_time?.slice(0,5)} – {schedule.end_time?.slice(0,5)}</div>
          </div>
        ) : (
          <div style={{ color: '#9ca3af', fontSize: 13, padding: '8px 0' }}>{t('noShiftToday')}</div>
        )}
      </div>

      {/* Godišnji odmor */}
      <div className={s.card}>
        <div className={s.cardTitle}>{t('vacation')}</div>
        <div className={s.vacRow} style={{ marginBottom: 10 }}>
          <div className={s.vacCard}>
            <div className={s.vacNum}>{vacTotal}</div>
            <div className={s.vacLabel}>{t('vacTotal')}</div>
          </div>
          <div className={s.vacCard} style={{ background: '#fef3c7' }}>
            <div className={s.vacNum} style={{ color: '#92400e' }}>{vacUsed}</div>
            <div className={s.vacLabel}>{t('vacUsed')}</div>
          </div>
          <div className={s.vacCard}>
            <div className={s.vacNum} style={{ color: '#0d7a52' }}>{vacRemaining}</div>
            <div className={s.vacLabel}>{t('vacRemaining')}</div>
          </div>
        </div>
        <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3,
            background: vacPct > 80 ? '#ef4444' : '#0d7a52',
            width: `${vacPct}%`, transition: 'width 0.4s'
          }} />
        </div>
      </div>

      {/* Pending zahtjevi */}
      {pendingCount > 0 && (
        <div className={s.homePendingBanner}>
          <span>⏳</span>
          <span>
            {pendingCount === 1 ? t('pendingAbsenceOne', { count: pendingCount }) : t('pendingAbsenceOther', { count: pendingCount })}
          </span>
        </div>
      )}
    </div>
  )
}
