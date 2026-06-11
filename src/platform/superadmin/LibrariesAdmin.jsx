import { lazy, Suspense } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import styles from './LibrariesAdmin.module.css'

// Objedinjuje tri biblioteke pod jedan sidebar tab „Biblioteke" sa pill navigacijom.
// Same biblioteke ostaju nepromijenjene komponente; lazy se učitavaju po piluli.
// Stare rute (/superadmin/recipes, /spa-treatments, /minibar-library) redirektuju ovamo.
const RecipeLibraryAdmin = lazy(() => import('./RecipeLibraryAdmin'))
const SpaTreatmentLibraryAdmin = lazy(() => import('./SpaTreatmentLibraryAdmin'))
const MinibarLibraryAdmin = lazy(() => import('./MinibarLibraryAdmin'))

const TABS = [
  { key: 'recepti',  label: 'Recepti',  Comp: RecipeLibraryAdmin },
  { key: 'tretmani', label: 'Tretmani', Comp: SpaTreatmentLibraryAdmin },
  { key: 'minibar',  label: 'Minibar',  Comp: MinibarLibraryAdmin },
]

export default function LibrariesAdmin() {
  const { tab } = useParams()
  const navigate = useNavigate()
  const active = TABS.find(t => t.key === tab)
  if (!active) return <Navigate to="/superadmin/libraries/recepti" replace />
  const Comp = active.Comp

  return (
    <div className={styles.wrap}>
      <div className={styles.pills}>
        {TABS.map(t => (
          <button
            key={t.key}
            className={`${styles.pill} ${t.key === tab ? styles.pillActive : ''}`}
            onClick={() => navigate(`/superadmin/libraries/${t.key}`)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Suspense fallback={<div className={styles.loading}>Učitavanje…</div>}>
        <Comp />
      </Suspense>
    </div>
  )
}
