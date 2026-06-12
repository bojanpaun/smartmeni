import { useTranslation } from 'react-i18next'
import ImageUpload from './ImageUpload'
import { toEmbedUrl } from '../../utils/videoUrl'
import styles from './LandingEditor.module.css'

function StarRating({ value = 5, onChange }) {
  return (
    <div className={styles.starRow}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" className={styles.starBtn} onClick={() => onChange(n)}>
          {n <= value ? '★' : '☆'}
        </button>
      ))}
    </div>
  )
}

function ReviewsList({ value, onChange }) {
  const { t } = useTranslation('admin')
  const items = Array.isArray(value) ? value : []
  const update = (idx, field, val) => onChange(items.map((it, i) => i === idx ? { ...it, [field]: val } : it))
  const add = () => { if (items.length >= 6) return; onChange([...items, { name: '', rating: 5, text: '', date: '' }]) }
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx))

  return (
    <div>
      {items.map((item, idx) => (
        <div key={idx} className={styles.listItemCard}>
          <div className={styles.listItemHeader}>
            <span className={styles.listItemNum}>{t('bfrReviewN', { n: idx + 1 })}</span>
            <button className={styles.removeItemBtn} onClick={() => remove(idx)}>{t('shRemove')}</button>
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>{t('bfrGuestName')}</label>
            <input className={styles.input} value={item.name || ''} onChange={e => update(idx, 'name', e.target.value)} placeholder={t('bfrGuestNamePh')} />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>{t('bfrRating')}</label>
            <StarRating value={item.rating || 5} onChange={v => update(idx, 'rating', v)} />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>{t('bfrReviewText')}</label>
            <textarea className={styles.textarea} rows={3} value={item.text || ''} onChange={e => update(idx, 'text', e.target.value)} placeholder={t('bfrReviewTextPh')} />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>{t('bfrDate')}</label>
            <input className={styles.input} value={item.date || ''} onChange={e => update(idx, 'date', e.target.value)} placeholder={t('bfrDatePh')} />
          </div>
        </div>
      ))}
      {items.length < 6 && <button className={styles.addItemBtn} onClick={add}>{t('bfrAddReview')}</button>}
    </div>
  )
}

function FaqList({ value, onChange }) {
  const { t } = useTranslation('admin')
  const items = Array.isArray(value) ? value : []
  const update = (idx, field, val) => onChange(items.map((it, i) => i === idx ? { ...it, [field]: val } : it))
  const add = () => { if (items.length >= 10) return; onChange([...items, { question: '', answer: '' }]) }
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx))

  return (
    <div>
      {items.map((item, idx) => (
        <div key={idx} className={styles.listItemCard}>
          <div className={styles.listItemHeader}>
            <span className={styles.listItemNum}>{t('bfrQuestionN', { n: idx + 1 })}</span>
            <button className={styles.removeItemBtn} onClick={() => remove(idx)}>{t('shRemove')}</button>
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>{t('bfrQuestion')}</label>
            <input className={styles.input} value={item.question || ''} onChange={e => update(idx, 'question', e.target.value)} placeholder={t('bfrQuestionPh')} />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>{t('bfrAnswer')}</label>
            <textarea className={styles.textarea} rows={3} value={item.answer || ''} onChange={e => update(idx, 'answer', e.target.value)} placeholder={t('bfrAnswerPh')} />
          </div>
        </div>
      ))}
      {items.length < 10 && <button className={styles.addItemBtn} onClick={add}>{t('bfrAddQuestion')}</button>}
    </div>
  )
}

function SpecialsList({ value, onChange, restaurantId }) {
  const { t } = useTranslation('admin')
  const items = Array.isArray(value) ? value : []
  const update = (idx, field, val) => onChange(items.map((it, i) => i === idx ? { ...it, [field]: val } : it))
  const add = () => { if (items.length >= 3) return; onChange([...items, { name: '', description: '', price: '', image_url: '' }]) }
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx))

  return (
    <div>
      {items.map((item, idx) => (
        <div key={idx} className={styles.listItemCard}>
          <div className={styles.listItemHeader}>
            <span className={styles.listItemNum}>{t('bfrSpecialN', { n: idx + 1 })}</span>
            <button className={styles.removeItemBtn} onClick={() => remove(idx)}>{t('shRemove')}</button>
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>{t('bfrDishName')}</label>
            <input className={styles.input} value={item.name || ''} onChange={e => update(idx, 'name', e.target.value)} placeholder={t('bfrDishNamePh')} />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>{t('bfrShortDesc')}</label>
            <input className={styles.input} value={item.description || ''} onChange={e => update(idx, 'description', e.target.value)} placeholder={t('bfrShortDescPh')} />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>{t('bfrPrice')}</label>
            <input className={styles.input} value={item.price || ''} onChange={e => update(idx, 'price', e.target.value)} placeholder={t('bfrPricePh')} />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>{t('bfrPhoto')}</label>
            <ImageUpload value={item.image_url || ''} onChange={url => update(idx, 'image_url', url)} restaurantId={restaurantId} />
          </div>
        </div>
      ))}
      {items.length < 3 && <button className={styles.addItemBtn} onClick={add}>{t('bfrAddSpecial')}</button>}
    </div>
  )
}

export default function BlockFieldRenderer({ field, value, onChange, restaurantId }) {
  if (field.type === 'image')
    return <ImageUpload value={value || ''} onChange={onChange} restaurantId={restaurantId} />

  if (field.type === 'image-gallery')
    return <ImageUpload value={value || ''} onChange={onChange} restaurantId={restaurantId} multiple />

  if (field.type === 'textarea')
    return (
      <textarea
        className={styles.textarea}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={field.rows || 4}
      />
    )

  if (field.type === 'reviews-list')
    return <ReviewsList value={value} onChange={onChange} />

  if (field.type === 'faq-list')
    return <FaqList value={value} onChange={onChange} />

  if (field.type === 'specials-list')
    return <SpecialsList value={value} onChange={onChange} restaurantId={restaurantId} />

  if (field.type === 'video-url') {
    const embed = toEmbedUrl(value)
    return (
      <div>
        <input
          type="url"
          className={styles.input}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
        />
        {embed && (
          <iframe
            src={embed}
            className={styles.videoPreview}
            allowFullScreen
            title="Video preview"
          />
        )}
      </div>
    )
  }

  const inputType = field.type === 'tel' ? 'tel' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'
  return (
    <input
      type={inputType}
      className={styles.input}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={field.placeholder}
    />
  )
}
