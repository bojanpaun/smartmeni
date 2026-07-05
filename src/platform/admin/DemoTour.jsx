import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import styles from './DemoTour.module.css'

/**
 * Vođeni tur kroz demo administraciju — reflektor + oblačić kroz module na hub-u
 * (/admin). Prikazuje se SAMO u demo tenantu (mount je gejtovan `isDemo` u App.jsx)
 * i SAMO na hub stranici (targeti — KPI, checklist, sekcije — žive tamo). Koraci se
 * vežu za `data-tour="..."` atribute u ControlPanel-u; ako target fali (npr. sekcija
 * skrivena po vertikali), korak se tretira kao centriran (bez reflektora).
 * Dismiss se pamti u sessionStorage; „Pokreni obilazak" pill vraća tur.
 * Lazy-loaded (import samo kad isDemo) → ne ulazi u init bundle.
 */

const STEPS = [
  { key: 'Intro',      target: null,             place: 'center' },
  { key: 'Kpis',       target: 'kpis',           place: 'bottom' },
  { key: 'Checklist',  target: 'checklist',      place: 'bottom' },
  { key: 'Restaurant', target: 'sec-restaurant', place: 'top' },
  { key: 'Hotel',      target: 'sec-hotel',      place: 'top' },
  { key: 'Manage',     target: 'sec-manage',     place: 'top' },
  { key: 'Outro',      target: null,             place: 'center' },
]
const DONE_KEY = 'demoTourDone'
const findEl = (target) => (target ? document.querySelector(`[data-tour="${target}"]`) : null)

export default function DemoTour() {
  const { t } = useTranslation('admin')
  const location = useLocation()
  const onHub = location.pathname === '/admin' || location.pathname === '/admin/'
  const [active, setActive] = useState(false)
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null) // null → centrirani korak (bez reflektora)

  const step = STEPS[i]

  const position = useCallback(() => {
    const s = STEPS[i]
    const el = s && s.target ? findEl(s.target) : null
    if (!el) { setRect(null); return }
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) { setRect(null); return }
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [i])

  // Auto-start jednom po sesiji, kad hub proradi
  useEffect(() => {
    if (!onHub || active) return
    if (sessionStorage.getItem(DONE_KEY)) return
    const timer = setTimeout(() => { setI(0); setActive(true) }, 800)
    return () => clearTimeout(timer)
  }, [onHub, active])

  // Na promjenu koraka: skroluj target u vidik pa pozicioniraj reflektor
  useEffect(() => {
    if (!active) return
    const s = STEPS[i]
    const el = s && s.target ? findEl(s.target) : null
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const timer = setTimeout(position, el ? 340 : 0)
    return () => clearTimeout(timer)
  }, [active, i, position])

  // Prati resize/scroll dok je tur aktivan
  useEffect(() => {
    if (!active) return
    const onMove = () => position()
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [active, position])

  const finish = useCallback(() => {
    setActive(false)
    try { sessionStorage.setItem(DONE_KEY, '1') } catch { /* private mode */ }
  }, [])
  const next = useCallback(() => {
    if (i >= STEPS.length - 1) finish()
    else setI(i + 1)
  }, [i, finish])
  const back = useCallback(() => { if (i > 0) setI(i - 1) }, [i])
  const restart = () => { setI(0); setActive(true) }

  // Tastatura
  useEffect(() => {
    if (!active) return
    const onKey = (e) => {
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') back()
      else if (e.key === 'Escape') finish()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, next, back, finish])

  if (!onHub) return null

  if (!active) {
    // Pill se pojavljuje tek kad je tur već jednom prošao/preskočen (ne bljeska prije auto-starta)
    let done = false
    try { done = !!sessionStorage.getItem(DONE_KEY) } catch { /* private mode */ }
    if (!done) return null
    return (
      <button className={styles.restartPill} onClick={restart} title={t('dtStart')}>
        ▶ {t('dtStart')}
      </button>
    )
  }

  const centered = !rect
  const W = Math.min(320, (typeof window !== 'undefined' ? window.innerWidth : 360) - 24)
  let tipStyle
  if (!centered) {
    const M = 12
    const vw = window.innerWidth
    const left = Math.max(M, Math.min(rect.left, vw - W - M))
    tipStyle = step.place === 'top'
      ? { left, top: rect.top - 14, width: W, transform: 'translateY(-100%)' }
      : { left, top: rect.top + rect.height + 14, width: W }
  }

  return (
    <div className={styles.root} role="dialog" aria-modal="true" aria-label={t('dtIntroTitle')}>
      <div className={styles.blocker} />
      {centered
        ? <div className={styles.backdrop} />
        : <div className={styles.spot} style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }} />}

      <div className={`${styles.tip} ${centered ? styles.tipCenter : ''}`} style={tipStyle}>
        <div className={styles.stepLabel}>{t('dtStepLabel', { n: i + 1, total: STEPS.length })}</div>
        <h4 className={styles.tipTitle}>{t(`dt${step.key}Title`)}</h4>
        <p className={styles.tipBody}>{t(`dt${step.key}Body`)}</p>
        <div className={styles.foot}>
          <div className={styles.dots}>
            {STEPS.map((_, k) => <span key={k} className={k === i ? styles.dotOn : styles.dot} />)}
          </div>
          <div className={styles.btns}>
            {i > 0 && <button className={styles.ghost} onClick={back}>{t('dtBack')}</button>}
            <button className={styles.prim} onClick={next}>
              {i === STEPS.length - 1 ? t('dtFinish') : t('dtNext')}
            </button>
          </div>
        </div>
        <button className={styles.skip} onClick={finish}>{t('dtSkip')}</button>
      </div>
    </div>
  )
}
