import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../lib/auditLog'

// Upravljanje bankovnim računima tenanta (više IBAN-a; jedan primarni). Primarni se
// mirror-uje na restaurants.iban (DB trigger) → fiskalni računi koriste primarni.
// Samostalna komponenta (vlastiti load/save) — ne ide kroz form save Opštih postavki.
export default function BankAccountsManager({ restaurantId }) {
  const { t } = useTranslation('admin')
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [iban, setIban] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)

  const fetchAccounts = () => supabase.from('tenant_bank_accounts')
    .select('id, iban, label, is_primary, sort_order')
    .eq('restaurant_id', restaurantId).order('is_primary', { ascending: false }).order('sort_order').order('created_at')

  const load = async () => {
    let { data } = await fetchAccounts()
    // Self-heal: zatečeni/onboarding restaurants.iban (bez reda u tabeli) → usvoji kao primarni.
    if ((!data || data.length === 0)) {
      const { data: r } = await supabase.from('restaurants').select('iban').eq('id', restaurantId).maybeSingle()
      if (r?.iban && r.iban.trim()) {
        await supabase.from('tenant_bank_accounts').insert({ restaurant_id: restaurantId, iban: r.iban.trim(), is_primary: true })
        ;({ data } = await fetchAccounts())
      }
    }
    setAccounts(data || []); setLoading(false)
  }
  useEffect(() => { if (restaurantId) load() }, [restaurantId])

  const add = async () => {
    if (!iban.trim()) return
    setBusy(true)
    const { error } = await supabase.from('tenant_bank_accounts')
      .insert({ restaurant_id: restaurantId, iban: iban.trim(), label: label.trim() || null, sort_order: accounts.length })
    setBusy(false)
    if (error) { toast.error(t('gsBankErr')); return }
    logAudit({
      restaurantId, action: 'bank_account.create',
      entityType: 'tenant_bank_account', entityId: null,
      summary: `Dodat bankovni račun: ${iban.trim()}`,
    })
    setIban(''); setLabel(''); load()
  }
  const remove = async (acc) => {
    if (!confirm(t('gsBankRemoveConfirm'))) return
    const { error } = await supabase.from('tenant_bank_accounts').delete().eq('id', acc.id)
    if (error) { toast.error(t('gsBankErr')); return }
    logAudit({
      restaurantId, action: 'bank_account.delete',
      entityType: 'tenant_bank_account', entityId: acc.id,
      summary: `Obrisan bankovni račun: ${acc.iban}`,
    })
    load()
  }
  const setPrimary = async (acc) => {
    const { error } = await supabase.rpc('set_primary_bank_account', { p_account_id: acc.id })
    if (error) { toast.error(t('gsBankErr')); return }
    logAudit({
      restaurantId, action: 'bank_account.set_primary',
      entityType: 'tenant_bank_account', entityId: acc.id,
      summary: `Primarni bankovni račun: ${acc.iban}`,
    })
    load()
  }

  const box = { border: '1px solid var(--c-border)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, background: 'var(--c-surface)' }
  const inp = { padding: '8px 10px', border: '1px solid var(--c-border-input, var(--c-border))', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: 'var(--c-surface)', color: 'var(--c-text)', boxSizing: 'border-box' }
  const ghostBtn = { padding: '6px 10px', border: '1px solid var(--c-border-input, var(--c-border))', borderRadius: 8, background: 'none', color: 'var(--c-text-medium)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }

  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>{t('gsBankAccounts')}</label>
      <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 10, lineHeight: 1.4 }}>{t('gsBankHint')}</div>

      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>{t('loading')}</div>
      ) : accounts.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--c-text-muted)', marginBottom: 8 }}>{t('gsBankEmpty')}</div>
      ) : accounts.map(acc => (
        <div key={acc.id} style={box}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: 'var(--c-text)', overflowWrap: 'anywhere' }}>{acc.iban}</div>
            {acc.label && <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{acc.label}</div>}
          </div>
          {acc.is_primary ? (
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-success, #0d7a52)', background: 'var(--c-success-bg, #E1F5EE)', borderRadius: 999, padding: '2px 9px', whiteSpace: 'nowrap' }}>★ {t('gsBankPrimary')}</span>
          ) : (
            <button style={ghostBtn} onClick={() => setPrimary(acc)}>{t('gsBankSetPrimary')}</button>
          )}
          <button style={{ ...ghostBtn, color: 'var(--c-danger, #b42318)' }} onClick={() => remove(acc)} title={t('htDelete')}>✕</button>
        </div>
      ))}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <input style={{ ...inp, flex: '2 1 200px' }} value={iban} onChange={e => setIban(e.target.value)} placeholder={t('gsIbanPh')} onKeyDown={e => e.key === 'Enter' && add()} />
        <input style={{ ...inp, flex: '1 1 130px' }} value={label} onChange={e => setLabel(e.target.value)} placeholder={t('gsBankLabelPh')} onKeyDown={e => e.key === 'Enter' && add()} />
        <button style={{ ...ghostBtn, padding: '8px 14px' }} onClick={add} disabled={busy || !iban.trim()}>+ {t('gsBankAdd')}</button>
      </div>
    </div>
  )
}
