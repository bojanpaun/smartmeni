import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import { logAudit } from '../../../lib/auditLog'
import { useSortable } from '../../../hooks/useSortable'
import SortableHead from '../../../components/shared/SortableHead'
import styles from './InventoryPage.module.css'
import gsStyles from '../../menu/pages/GeneralSettings.module.css'

const CATEGORIES = ['fnb', 'spa', 'housekeeping', 'technical', 'other']
const CAT_KEY = {
  fnb: 'supCatFnb', spa: 'supCatSpa', housekeeping: 'supCatHousekeeping',
  technical: 'supCatTechnical', other: 'supCatOther',
}
const BLANK = {
  name: '', category: 'fnb', contact_person: '', email: '', phone: '',
  payment_terms: '', lead_days: '', rating: '', note: '',
}

export default function SuppliersPage() {
  const { restaurant } = usePlatform()
  const { t } = useTranslation('admin')
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('sve')
  const [showForm, setShowForm] = useState(false)
  const [editSup, setEditSup] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const sort = useSortable('name', 'asc')

  const load = async () => {
    if (!restaurant?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('suppliers')
      .select('id, name, category, contact_person, email, phone, payment_terms, lead_days, rating, note')
      .eq('restaurant_id', restaurant.id)
      .order('name')
    setSuppliers(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [restaurant?.id])

  const openForm = (sup = null) => {
    setEditSup(sup)
    setForm(sup ? {
      name: sup.name || '', category: sup.category || 'fnb',
      contact_person: sup.contact_person || '', email: sup.email || '', phone: sup.phone || '',
      payment_terms: sup.payment_terms || '', lead_days: sup.lead_days ?? '',
      rating: sup.rating ?? '', note: sup.note || '',
    } : BLANK)
    setShowForm(true)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      restaurant_id: restaurant.id,
      name: form.name.trim(),
      category: form.category,
      contact_person: form.contact_person.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      payment_terms: form.payment_terms.trim() || null,
      lead_days: form.lead_days === '' ? null : parseInt(form.lead_days) || null,
      rating: form.rating === '' ? null : parseInt(form.rating),
      note: form.note.trim() || null,
    }
    let savedId = editSup?.id
    if (editSup) {
      await supabase.from('suppliers').update(payload).eq('id', editSup.id)
    } else {
      const { data } = await supabase.from('suppliers').insert(payload).select('id').single()
      savedId = data?.id
    }
    logAudit({
      restaurantId: restaurant.id,
      action: editSup ? 'supplier.updated' : 'supplier.created',
      entityType: 'supplier', entityId: savedId,
      summary: `${editSup ? 'Izmijenjen' : 'Dodat'} dobavljač: ${payload.name}`,
    })
    setSaving(false)
    setShowForm(false)
    setEditSup(null)
    load()
  }

  const remove = async (sup) => {
    if (!confirm(t('supDeleteConfirm', { name: sup.name }))) return
    await supabase.from('suppliers').delete().eq('id', sup.id)
    setSuppliers(prev => prev.filter(s => s.id !== sup.id))
    logAudit({
      restaurantId: restaurant.id, action: 'supplier.deleted',
      entityType: 'supplier', entityId: sup.id,
      summary: `Obrisan dobavljač: ${sup.name}`,
    })
  }

  const catLabel = (c) => (CAT_KEY[c] ? t(CAT_KEY[c]) : c)
  const stars = (r) => (r ? '★'.repeat(r) + '☆'.repeat(5 - r) : '—')

  const filtered = suppliers.filter(s => {
    const matchCat = filterCat === 'sve' || s.category === filterCat
    const matchSearch = !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.contact_person || '').toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  if (loading) return <div className={styles.loading}>{t('invLoading')}</div>

  return (
    <div className={gsStyles.page} style={{ maxWidth: 960 }}>
      <div className={styles.header}>
        <div>
          <h1 className={gsStyles.title}>{t('supTitle')}</h1>
          <p className={gsStyles.subtitle}>{t('supSubtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnAdd} onClick={() => openForm()}>+ {t('supNew')}</button>
        </div>
      </div>

      <div className={styles.filters}>
        <input className={styles.search} placeholder={t('supSearchPh')}
          value={search} onChange={e => setSearch(e.target.value)} />
        <div className={styles.filterCats}>
          {['sve', ...CATEGORIES].map(c => (
            <button key={c}
              className={`${styles.filterBtn} ${filterCat === c ? styles.filterBtnActive : ''}`}
              onClick={() => setFilterCat(c)}>
              {c === 'sve' ? t('supCatAll') : catLabel(c)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🚚</div>
          <div>{t('supEmpty')}</div>
          <button className={styles.btnAdd} onClick={() => openForm()}>+ {t('supAddFirst')}</button>
        </div>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHeader}>
            <span><SortableHead col="name" label={t('supColName')} sortBy={sort.sortBy} sortDir={sort.sortDir} onSort={sort.onSort} /></span>
            <span><SortableHead col="category" label={t('supColCategory')} sortBy={sort.sortBy} sortDir={sort.sortDir} onSort={sort.onSort} /></span>
            <span>{t('supColContact')}</span>
            <span><SortableHead col="rating" label={t('supColRating')} sortBy={sort.sortBy} sortDir={sort.sortDir} onSort={sort.onSort} /></span>
            <span><SortableHead col="lead_days" label={t('supColLead')} sortBy={sort.sortBy} sortDir={sort.sortDir} onSort={sort.onSort} /></span>
            <span></span>
          </div>
          {sort.sort(filtered).map(sup => (
            <div key={sup.id} className={styles.tableRow}>
              <div className={styles.itemName}>
                {sup.name}
                {sup.payment_terms && <span className={styles.itemNote}>{sup.payment_terms}</span>}
              </div>
              <div className={styles.itemCat}>{catLabel(sup.category)}</div>
              <div className={styles.itemMin}>
                {sup.contact_person || sup.phone || sup.email || '—'}
              </div>
              <div className={styles.itemCost} title={sup.rating ? `${sup.rating}/5` : ''}>{stars(sup.rating)}</div>
              <div className={styles.itemMin}>{sup.lead_days != null ? t('supLeadDaysVal', { n: sup.lead_days }) : '—'}</div>
              <div className={styles.itemActions}>
                <button className={styles.btnEdit} onClick={() => openForm(sup)} title={t('edit')}>✏️</button>
                <button className={styles.btnDelete} onClick={() => remove(sup)} title={t('delete')}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className={styles.overlay} onClick={() => setShowForm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>{editSup ? t('supEdit') : t('supNew')}</div>
              <button className={styles.modalClose} onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form className={styles.form} onSubmit={save}>
              <div className={styles.grid}>
                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <label>{t('supName')} *</label>
                  <input value={form.name} placeholder={t('supNamePh')}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className={styles.field}>
                  <label>{t('supColCategory')}</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>{t('supRating')}</label>
                  <select value={form.rating} onChange={e => setForm(f => ({ ...f, rating: e.target.value }))}>
                    <option value="">{t('supNoRating')}</option>
                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{'★'.repeat(n)} ({n})</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>{t('supContactPerson')}</label>
                  <input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label>{t('supPhone')}</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label>{t('supEmail')}</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label>{t('supLeadDays')}</label>
                  <input type="number" min="0" value={form.lead_days}
                    onChange={e => setForm(f => ({ ...f, lead_days: e.target.value }))} />
                </div>
                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <label>{t('supPaymentTerms')}</label>
                  <input value={form.payment_terms} placeholder={t('supPaymentTermsPh')}
                    onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} />
                </div>
                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <label>{t('supNote')}</label>
                  <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="button" className={styles.btnCancelForm} onClick={() => setShowForm(false)}>{t('cancel')}</button>
                <button type="submit" className={styles.btnSave} disabled={saving}>
                  {saving ? t('saving') : t('supSave')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
