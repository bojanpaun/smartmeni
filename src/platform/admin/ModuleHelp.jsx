import { useTranslation } from 'react-i18next'
import styles from './ModuleHelp.module.css'

// Sadržaj uputstava živi u `modulehelp` i18next namespace-u (lazy, admin-only) —
// po jezik jedan JSON: src/i18n/locales/{lng}/modulehelp.json. Ovdje samo render.
// `content` je objekat { [moduleKey]: { title, intro, sections:[{icon,title,steps[]}], tips[] } }.
export default function ModuleHelp({ moduleKey }) {
  const { t, ready } = useTranslation('modulehelp')

  // Namespace je lazy — dok se ne učita, ne prikazuj "nije dostupno" (false negative).
  if (!ready) return <div className={styles.page} />

  const content = t('content', { returnObjects: true })
  const help = content && typeof content === 'object' ? content[moduleKey] : null

  if (!help || typeof help !== 'object') return (
    <div className={styles.page}>
      <p className={styles.empty}>{t('notAvailable')}</p>
    </div>
  )

  const sections = Array.isArray(help.sections) ? help.sections : []
  const tips = Array.isArray(help.tips) ? help.tips : []

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{help.title}</h1>
        <p className={styles.intro}>{help.intro}</p>
      </div>

      {sections.length > 0 && (
        <div className={styles.sections}>
          {sections.map((sec, i) => (
            <div key={i} className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionIcon}>{sec.icon}</span>
                <h2 className={styles.sectionTitle}>{sec.title}</h2>
              </div>
              <ol className={styles.steps}>
                {sec.steps.map((step, j) => (
                  <li key={j} className={styles.step}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      {tips.length > 0 && (
        <div className={styles.tips}>
          <div className={styles.tipsTitle}>💡 {t('tipsLabel')}</div>
          <ul className={styles.tipsList}>
            {tips.map((tip, i) => (
              <li key={i} className={styles.tip}>{tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
