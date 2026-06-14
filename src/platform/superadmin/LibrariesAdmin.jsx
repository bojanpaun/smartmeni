import { lazy, Suspense, useState } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import { translateLibraries } from '../../lib/contentTranslate'
import styles from './LibrariesAdmin.module.css'

// Objedinjuje tri biblioteke pod jedan sidebar tab „Biblioteke" sa pill navigacijom.
// Same biblioteke ostaju nepromijenjene komponente; lazy se učitavaju po piluli.
// Stare rute (/superadmin/recipes, /spa-treatments, /minibar-library) redirektuju ovamo.
const RecipeLibraryAdmin = lazy(() => import('./RecipeLibraryAdmin'))
const SpaTreatmentLibraryAdmin = lazy(() => import('./SpaTreatmentLibraryAdmin'))
const MinibarLibraryAdmin = lazy(() => import('./MinibarLibraryAdmin'))

const TABS = [
  { key: 'recepti',  labelKey: 'saLibRecipes',    Comp: RecipeLibraryAdmin },
  { key: 'tretmani', labelKey: 'saLibTreatments', Comp: SpaTreatmentLibraryAdmin },
  { key: 'minibar',  labelKey: 'saLibMinibar',    Comp: MinibarLibraryAdmin },
]

export default function LibrariesAdmin() {
  const { tab } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation('admin')
  const [transBusy, setTransBusy] = useState(false)
  const active = TABS.find(x => x.key === tab)
  if (!active) return <Navigate to="/superadmin/libraries/recepti" replace />
  const Comp = active.Comp

  // Prevedi sve biblioteke (name) na 6 jezika → library_translations (edge, superadmin).
  const doTranslate = async () => {
    setTransBusy(true)
    try {
      const res = await translateLibraries()
      toast.success(t('saLibTranslatedN', { n: res?.translated ?? 0 }))
    } catch (e) {
      toast.error(e?.message || t('saLibTranslateErr'))
    } finally {
      setTransBusy(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.pills}>
        {TABS.map(x => (
          <button
            key={x.key}
            className={`${styles.pill} ${x.key === tab ? styles.pillActive : ''}`}
            onClick={() => navigate(`/superadmin/libraries/${x.key}`)}
          >
            {t(x.labelKey)}
          </button>
        ))}
        <button
          className={styles.pill}
          style={{ marginLeft: 'auto' }}
          onClick={doTranslate}
          disabled={transBusy}
          title={t('saLibTranslateHint')}
        >
          🌐 {transBusy ? t('saLibTranslating') : t('saLibTranslate')}
        </button>
      </div>
      <Suspense fallback={<div className={styles.loading}>{t('loading')}</div>}>
        <Comp />
      </Suspense>
    </div>
  )
}
