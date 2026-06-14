import { useTranslation } from 'react-i18next'
import { usePlatform } from '../context/PlatformContext'
import { formatMoney } from './currencies'

// FISK-0 — Admin-facing helper: formatira novac u valuti AKTIVNOG tenanta
// (restaurant.currency iz PlatformContext-a) na jeziku admina. Vraća `money(amount)`.
//
// KORISTITI za tenant-operativni novac (analitika, folio, payroll, spa, inventory…).
// NE koristiti za:
//   • guest-facing površine → tamo valuta je restorana KOJI SE GLEDA (ne tenant iz
//     konteksta); zovi formatMoney(amount, restaurant.currency, i18n.language) direktno.
//   • platform-billing (pretplata tenant→platforma: planovi, BillingPage, Landing) →
//     to je PLATFORMSKA valuta (EUR), ne tenantova operativna valuta.
export function useMoney() {
  const { restaurant } = usePlatform()
  const { i18n } = useTranslation()
  return (amount) => formatMoney(amount, restaurant?.currency, i18n.language)
}
