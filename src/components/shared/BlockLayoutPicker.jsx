import styles from './LandingEditor.module.css'

const OPTIONS = {
  hero:            [{ v: 'fullscreen', l: 'Fullscreen', i: '⬛' }, { v: 'compact', l: 'Kompaktan', i: '▬' }, { v: 'split', l: 'Split', i: '◫' }],
  about:           [{ v: 'image-right', l: 'Slika desno', i: '◧' }, { v: 'image-left', l: 'Slika lijevo', i: '◨' }, { v: 'text-only', l: 'Samo tekst', i: '≡' }],
  story:           [{ v: 'image-right', l: 'Slika desno', i: '◧' }, { v: 'image-left', l: 'Slika lijevo', i: '◨' }, { v: 'text-only', l: 'Samo tekst', i: '≡' }, { v: 'image-above', l: 'Slika gore', i: '⊟' }],
  gallery:         [{ v: 'grid-3', l: '3 kolone', i: '⊞' }, { v: 'grid-2', l: '2 kolone', i: '⊟' }, { v: 'masonry', l: 'Masonry', i: '▦' }],
  amenities:       [{ v: 'icons-row', l: 'Ikone', i: '◈' }, { v: 'list', l: 'Lista', i: '≡' }, { v: 'cards', l: 'Kartice', i: '⊞' }],
  contact:         [{ v: 'card', l: 'Kartica', i: '▭' }, { v: 'minimal', l: 'Minimalan', i: '—' }, { v: 'two-column', l: '2 kolone', i: '◫' }],
  location:        [{ v: 'card-with-map', l: 'Sa mapom', i: '▤' }, { v: 'card-only', l: 'Bez mape', i: '▭' }],
  hours_location:  [{ v: 'card-with-map', l: 'Sa mapom', i: '▤' }, { v: 'card-only', l: 'Bez mape', i: '▭' }],
  reservation_cta: [{ v: 'banner', l: 'Banner', i: '▬' }, { v: 'card', l: 'Kartica', i: '▭' }, { v: 'minimal', l: 'Minimalan', i: '—' }],
  reviews:         [{ v: 'cards', l: 'Kartice', i: '⊞' }, { v: 'list', l: 'Lista', i: '≡' }, { v: 'featured', l: 'Istaknuto', i: '★' }],
  video:           [{ v: 'full', l: 'Puni width', i: '▬' }, { v: 'centered', l: 'Centrirano', i: '▭' }],
  cta_banner:      [{ v: 'centered', l: 'Centrirano', i: '▬' }, { v: 'left-aligned', l: 'Lijevo', i: '▭' }],
  faq:             [{ v: 'default', l: 'Jedna kol.', i: '≡' }, { v: 'two-column', l: 'Dvije kol.', i: '◫' }],
  specials:        [{ v: 'cards', l: 'Kartice', i: '⊞' }, { v: 'list', l: 'Lista', i: '≡' }],
  menu_preview:    [{ v: 'grid', l: 'Grid', i: '⊞' }, { v: 'list', l: 'Lista', i: '≡' }, { v: 'cards', l: 'Kartice', i: '▭' }],
}

export default function BlockLayoutPicker({ blockType, value, onChange }) {
  const opts = OPTIONS[blockType]
  if (!opts) return null
  return (
    <div className={styles.formRow}>
      <div className={styles.layoutPickerLabel}>Izgled bloka</div>
      <div className={styles.layoutPicker}>
        {opts.map(opt => (
          <button
            key={opt.v}
            type="button"
            className={`${styles.layoutOption} ${value === opt.v ? styles.layoutOptionActive : ''}`}
            onClick={() => onChange(opt.v)}
          >
            <span className={styles.layoutIcon}>{opt.i}</span>
            <span className={styles.layoutLabel}>{opt.l}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
