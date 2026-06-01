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
  const items = Array.isArray(value) ? value : []
  const update = (idx, field, val) => onChange(items.map((it, i) => i === idx ? { ...it, [field]: val } : it))
  const add = () => { if (items.length >= 6) return; onChange([...items, { name: '', rating: 5, text: '', date: '' }]) }
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx))

  return (
    <div>
      {items.map((item, idx) => (
        <div key={idx} className={styles.listItemCard}>
          <div className={styles.listItemHeader}>
            <span className={styles.listItemNum}>Recenzija {idx + 1}</span>
            <button className={styles.removeItemBtn} onClick={() => remove(idx)}>Ukloni</button>
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>Ime gosta</label>
            <input className={styles.input} value={item.name || ''} onChange={e => update(idx, 'name', e.target.value)} placeholder="Npr. Ana P." />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>Ocjena</label>
            <StarRating value={item.rating || 5} onChange={v => update(idx, 'rating', v)} />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>Tekst recenzije</label>
            <textarea className={styles.textarea} rows={3} value={item.text || ''} onChange={e => update(idx, 'text', e.target.value)} placeholder="Odličan hotel, preporučujem..." />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>Datum (opcionalno)</label>
            <input className={styles.input} value={item.date || ''} onChange={e => update(idx, 'date', e.target.value)} placeholder="Maj 2025" />
          </div>
        </div>
      ))}
      {items.length < 6 && <button className={styles.addItemBtn} onClick={add}>+ Dodaj recenziju</button>}
    </div>
  )
}

function FaqList({ value, onChange }) {
  const items = Array.isArray(value) ? value : []
  const update = (idx, field, val) => onChange(items.map((it, i) => i === idx ? { ...it, [field]: val } : it))
  const add = () => { if (items.length >= 10) return; onChange([...items, { question: '', answer: '' }]) }
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx))

  return (
    <div>
      {items.map((item, idx) => (
        <div key={idx} className={styles.listItemCard}>
          <div className={styles.listItemHeader}>
            <span className={styles.listItemNum}>Pitanje {idx + 1}</span>
            <button className={styles.removeItemBtn} onClick={() => remove(idx)}>Ukloni</button>
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>Pitanje</label>
            <input className={styles.input} value={item.question || ''} onChange={e => update(idx, 'question', e.target.value)} placeholder="Npr. Imate li bazen?" />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>Odgovor</label>
            <textarea className={styles.textarea} rows={3} value={item.answer || ''} onChange={e => update(idx, 'answer', e.target.value)} placeholder="Da, bazen je dostupan od 8–22h..." />
          </div>
        </div>
      ))}
      {items.length < 10 && <button className={styles.addItemBtn} onClick={add}>+ Dodaj pitanje</button>}
    </div>
  )
}

function SpecialsList({ value, onChange, restaurantId }) {
  const items = Array.isArray(value) ? value : []
  const update = (idx, field, val) => onChange(items.map((it, i) => i === idx ? { ...it, [field]: val } : it))
  const add = () => { if (items.length >= 3) return; onChange([...items, { name: '', description: '', price: '', image_url: '' }]) }
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx))

  return (
    <div>
      {items.map((item, idx) => (
        <div key={idx} className={styles.listItemCard}>
          <div className={styles.listItemHeader}>
            <span className={styles.listItemNum}>Specijalitet {idx + 1}</span>
            <button className={styles.removeItemBtn} onClick={() => remove(idx)}>Ukloni</button>
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>Naziv jela</label>
            <input className={styles.input} value={item.name || ''} onChange={e => update(idx, 'name', e.target.value)} placeholder="Grilled brancin" />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>Kratki opis</label>
            <input className={styles.input} value={item.description || ''} onChange={e => update(idx, 'description', e.target.value)} placeholder="Svježi morski specijalitet..." />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>Cijena</label>
            <input className={styles.input} value={item.price || ''} onChange={e => update(idx, 'price', e.target.value)} placeholder="18€" />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>Fotografija</label>
            <ImageUpload value={item.image_url || ''} onChange={url => update(idx, 'image_url', url)} restaurantId={restaurantId} />
          </div>
        </div>
      ))}
      {items.length < 3 && <button className={styles.addItemBtn} onClick={add}>+ Dodaj specijalitet</button>}
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
