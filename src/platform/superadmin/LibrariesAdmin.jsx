import { lazy, Suspense } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
  const active = TABS.find(x => x.key === tab)
  if (!active) return <Navigate to="/superadmin/libraries/recepti" replace />
  const Comp = active.Comp

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
      </div>
      <Suspense fallback={<div className={styles.loading}>{t('loading')}</div>}>
        <Comp />
      </Suspense>
    </div>
  )
}
