import { useTranslation } from 'react-i18next'
import styles from './LandingEditor.module.css'

// l = ključ u `admin` namespace-u (blkLo*); i = ikona; v = vrijednost layout-a
const OPTIONS = {
  hero:            [{ v: 'fullscreen', l: 'blkLoFullscreen', i: '⬛' }, { v: 'compact', l: 'blkLoCompact', i: '▬' }, { v: 'split', l: 'blkLoSplit', i: '◫' }],
  about:           [{ v: 'image-right', l: 'blkLoImageRight', i: '◧' }, { v: 'image-left', l: 'blkLoImageLeft', i: '◨' }, { v: 'text-only', l: 'blkLoTextOnly', i: '≡' }],
  story:           [{ v: 'image-right', l: 'blkLoImageRight', i: '◧' }, { v: 'image-left', l: 'blkLoImageLeft', i: '◨' }, { v: 'text-only', l: 'blkLoTextOnly', i: '≡' }, { v: 'image-above', l: 'blkLoImageAbove', i: '⊟' }],
  gallery:         [{ v: 'grid-3', l: 'blkLoGrid3', i: '⊞' }, { v: 'grid-2', l: 'blkLoGrid2', i: '⊟' }, { v: 'masonry', l: 'blkLoMasonry', i: '▦' }],
  amenities:       [{ v: 'icons-row', l: 'blkLoIcons', i: '◈' }, { v: 'list', l: 'blkLoList', i: '≡' }, { v: 'cards', l: 'blkLoCards', i: '⊞' }],
  contact:         [{ v: 'card', l: 'blkLoCard', i: '▭' }, { v: 'minimal', l: 'blkLoMinimal', i: '—' }, { v: 'two-column', l: 'blkLoGrid2', i: '◫' }],
  location:        [{ v: 'card-with-map', l: 'blkLoMapYes', i: '▤' }, { v: 'card-only', l: 'blkLoMapNo', i: '▭' }],
  hours_location:  [{ v: 'card-with-map', l: 'blkLoMapYes', i: '▤' }, { v: 'card-only', l: 'blkLoMapNo', i: '▭' }],
  reservation_cta: [{ v: 'banner', l: 'blkLoBanner', i: '▬' }, { v: 'card', l: 'blkLoCard', i: '▭' }, { v: 'minimal', l: 'blkLoMinimal', i: '—' }],
  reviews:         [{ v: 'cards', l: 'blkLoCards', i: '⊞' }, { v: 'list', l: 'blkLoList', i: '≡' }, { v: 'featured', l: 'blkLoFeatured', i: '★' }],
  video:           [{ v: 'full', l: 'blkLoFullWidth', i: '▬' }, { v: 'centered', l: 'blkLoCentered', i: '▭' }],
  cta_banner:      [{ v: 'centered', l: 'blkLoCentered', i: '▬' }, { v: 'left-aligned', l: 'blkLoLeft', i: '▭' }],
  faq:             [{ v: 'default', l: 'blkLoOneCol', i: '≡' }, { v: 'two-column', l: 'blkLoTwoCol', i: '◫' }],
  specials:        [{ v: 'cards', l: 'blkLoCards', i: '⊞' }, { v: 'list', l: 'blkLoList', i: '≡' }],
  menu_preview:    [{ v: 'grid', l: 'blkLoGrid', i: '⊞' }, { v: 'list', l: 'blkLoList', i: '≡' }, { v: 'cards', l: 'blkLoCards', i: '▭' }],
}

const COL_SPLITS = [
  { value: '30-70', label: '30 / 70' },
  { value: '40-60', label: '40 / 60' },
  { value: '50-50', label: '50 / 50' },
  { value: '60-40', label: '60 / 40' },
  { value: '70-30', label: '70 / 30' },
]

export function ColSplitPicker({ value, onChange }) {
  const { t } = useTranslation('admin')
  return (
    <div className={styles.formRow}>
      <div className={styles.layoutPickerLabel}>{t('blkColWidth')}</div>
      <div className={styles.layoutPicker}>
        {COL_SPLITS.map(opt => (
          <button
            key={opt.value}
            type="button"
            className={`${styles.layoutOption} ${value === opt.value ? styles.layoutOptionActive : ''}`}
            onClick={() => onChange(opt.value)}
          >
            <span className={styles.layoutLabel}>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function BlockLayoutPicker({ blockType, value, onChange }) {
  const { t } = useTranslation('admin')
  const opts = OPTIONS[blockType]
  if (!opts) return null
  return (
    <div className={styles.formRow}>
      <div className={styles.layoutPickerLabel}>{t('blkBlockLayout')}</div>
      <div className={styles.layoutPicker}>
        {opts.map(opt => (
          <button
            key={opt.v}
            type="button"
            className={`${styles.layoutOption} ${value === opt.v ? styles.layoutOptionActive : ''}`}
            onClick={() => onChange(opt.v)}
          >
            <span className={styles.layoutIcon}>{opt.i}</span>
            <span className={styles.layoutLabel}>{t(opt.l)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
