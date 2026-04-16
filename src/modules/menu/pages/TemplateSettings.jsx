import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import { TEMPLATES, getTemplate } from '../../../lib/templates'
import styles from './TemplateSettings.module.css'

// Mini preview guest menija
function MenuPreview({ template: t }) {
  return (
    <div className={styles.phone} style={{ background: t.pageBg }}>
      {/* Header */}
      <div className={styles.phoneHeader} style={{ background: t.brand }}>
        <div className={styles.phoneHeaderTop}>
          <span className={styles.phoneTag}>Sto 4</span>
          <span className={styles.phoneLang}>BS</span>
        </div>
        <div className={styles.phoneRest}>
          <div className={styles.phoneLogo}>B</div>
          <div>
            <div className={styles.phoneName}>Vaš restoran</div>
            <div className={styles.phoneMeta}>Budva · 10:00–23:00</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className={styles.phoneSearch}>
        🔍 Pretražite meni...
      </div>

      {/* Kategorije */}
      <div className={styles.phoneCats}>
        <div
          className={styles.phoneCatActive}
          style={{ background: t.catBg, color: t.catColor, borderColor: t.catBorder }}
        >
          🍽️ Predjela
        </div>
        <div className={styles.phoneCat}>🐟 Riba</div>
        <div className={styles.phoneCat}>🍕 Pizza</div>
      </div>

      {/* Stavke */}
      <div className={styles.phoneItems}>
        <div className={styles.phoneItem} style={{ background: t.cardBg }}>
          <div className={styles.phoneEmoji} style={{ background: t.itemAccentBg }}>🥗</div>
          <div className={styles.phoneItemBody}>
            <div className={styles.phoneItemName}>Grčka salata</div>
            <div className={styles.phoneItemDesc}>Feta, masline, krastavac</div>
            <div className={styles.phoneItemPrice} style={{ color: t.priceColor }}>€4.50</div>
          </div>
        </div>
        <div className={styles.phoneItem} style={{ background: t.cardBg }}>
          <div className={styles.phoneEmoji} style={{ background: t.itemAccentBg }}>🦑</div>
          <div className={styles.phoneItemBody}>
            <div className={styles.phoneItemName}>Lignje na žaru</div>
            <div className={styles.phoneItemDesc}>Mediteranske lignje</div>
            <div className={styles.phoneItemPrice} style={{ color: t.priceColor }}>€8.00</div>
          </div>
        </div>
      </div>

      {/* Konobar */}
      <div className={styles.phoneWaiter}>🔔 Pozovi konobara</div>
    </div>
  )
}

export default function TemplateSettings() {
  const { restaurant } = usePlatform()
  const [selected, setSelected] = useState('modern_minimal')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (restaurant?.template) {
      setSelected(restaurant.template)
    }
  }, [restaurant])

  const activeTemplate = getTemplate(selected)

  const handleSave = async () => {
    if (!restaurant) return
    setSaving(true)
    await supabase
      .from('restaurants')
      .update({ template: selected, color: activeTemplate.brand })
      .eq('id', restaurant.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Predlošci</h1>
        <p className={styles.subtitle}>
          Odaberi vizualni stil guest menija. Promjena je vidljiva gostima odmah.
        </p>
      </div>

      <div className={styles.layout}>

        {/* Lijevo — grid predložaka */}
        <div className={styles.pickerCol}>
          <div className={styles.grid}>
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                className={`${styles.tcard} ${selected === t.id ? styles.tcardActive : ''}`}
                onClick={() => setSelected(t.id)}
              >
                <div className={styles.tswatch} style={{ background: t.brand }} />
                <div className={styles.tname}>{t.name}</div>
                <div className={styles.tdesc}>{t.desc}</div>
                {selected === t.id && (
                  <div className={styles.tcheck}>✓</div>
                )}
              </button>
            ))}
          </div>

          <div className={styles.actions}>
            <button
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Čuvanje...' : saved ? '✓ Primijenjeno!' : 'Primijeni predložak'}
            </button>
            {restaurant && (
              <a
                href={`/${restaurant.slug}`}
                target="_blank"
                rel="noreferrer"
                className={styles.previewLink}
              >
                👁 Otvori live meni →
              </a>
            )}
          </div>
        </div>

        {/* Desno — live preview */}
        <div className={styles.previewCol}>
          <div className={styles.previewLabel}>Preview</div>
          <MenuPreview template={activeTemplate} />
          <div className={styles.previewInfo}>
            <div className={styles.previewName}>{activeTemplate.name}</div>
            <div className={styles.previewDesc}>{activeTemplate.desc}</div>
          </div>
        </div>

      </div>
    </div>
  )
}
