import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import { useAssets } from '../hooks/useAssets'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import styles from './PricingPage.module.css'

const emptyRow = () => ({ date_from: '', date_to: '', price: '', min_duration: '' })

export default function PricingPage() {
  const { restaurant } = usePlatform()
  const { t } = useTranslation('admin')
  const navigate = useNavigate()
  const { assets, loading } = useAssets(restaurant?.id)
  const [assetId, setAssetId] = useState('')
  const [rows, setRows] = useState([])
  const [draft, setDraft] = useState(emptyRow())
  const [busy, setBusy] = useState(false)

  // Predizaberi prvo sredstvo kad se učitaju.
  useEffect(() => { if (!assetId && assets.length) setAssetId(assets[0].id) }, [assets, assetId])

  const loadRows = useCallback(async () => {
    if (!assetId) { setRows([]); return }
    const { data } = await supabase.from('rental_pricing')
      .select('id, date_from, date_to, price, min_duration')
      .eq('restaurant_id', restaurant.id).eq('asset_id', assetId)
      .order('date_from')
    setRows(data || [])
  }, [assetId, restaurant?.id])

  useEffect(() => { loadRows() }, [loadRows])

  const add = async () => {
    if (!draft.date_from || !draft.date_to || draft.price === '') return toast.error(t('rpRangeErr'))
    if (draft.date_to < draft.date_from) return toast.error(t('rpRangeErr'))
    setBusy(true)
    const { error } = await supabase.from('rental_pricing').insert({
      restaurant_id: restaurant.id, asset_id: assetId,
      date_from: draft.date_from, date_to: draft.date_to,
      price: parseFloat(draft.price) || 0,
      min_duration: draft.min_duration === '' ? null : parseInt(draft.min_duration),
    })
    setBusy(false)
    if (error) return toast.error(t('rpSaveErr'))
    toast.success(t('rpAdded'))
    setDraft(emptyRow())
    loadRows()
  }

  const del = async (id) => {
    if (!window.confirm(t('rpDeleteConfirm'))) return
    await supabase.from('rental_pricing').delete().eq('id', id).eq('restaurant_id', restaurant.id)
    toast.success(t('rpDeleted'))
    loadRows()
  }

  if (loading) return <LoadingSpinner fullPage />

  return (
    <div className={styles.wrap}>
      <button className={styles.btnBack} onClick={() => navigate('/admin/rental')}>← {t('modRental')}</button>
      <h1 className={styles.title}>{t('rpTitle')}</h1>
      <p className={styles.subtitle}>{t('rpSubtitle')}</p>

      {assets.length === 0 ? (
        <div className={styles.empty}>{t('rpNoAssets')}</div>
      ) : (
        <>
          <label className={styles.field}>{t('rpSelectAsset')}
            <select className={styles.input} value={assetId} onChange={e => setAssetId(e.target.value)}>
              {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>

          <div className={styles.addRow}>
            <input className={styles.input} type="date" value={draft.date_from} onChange={e => setDraft(d => ({ ...d, date_from: e.target.value }))} aria-label={t('rpDateFrom')} />
            <input className={styles.input} type="date" value={draft.date_to} onChange={e => setDraft(d => ({ ...d, date_to: e.target.value }))} aria-label={t('rpDateTo')} />
            <input className={styles.input} type="number" min={0} placeholder={t('rpPrice')} value={draft.price} onChange={e => setDraft(d => ({ ...d, price: e.target.value }))} />
            <input className={styles.inputSm} type="number" min={1} placeholder={t('rpMinDuration')} value={draft.min_duration} onChange={e => setDraft(d => ({ ...d, min_duration: e.target.value }))} />
            <button className={styles.btnPrimary} onClick={add} disabled={busy}>+ {t('rpAdd')}</button>
          </div>

          {rows.length === 0 ? (
            <div className={styles.empty}>{t('rpNone')}</div>
          ) : (
            <div className={styles.list}>
              {rows.map(r => (
                <div key={r.id} className={styles.row}>
                  <span className={styles.dates}>{r.date_from} → {r.date_to}</span>
                  <span className={styles.price}>{r.price} €{r.min_duration ? ` · ${t('rpMinDuration')}: ${r.min_duration}` : ''}</span>
                  <button className={styles.iconBtn} onClick={() => del(r.id)}>🗑️</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
