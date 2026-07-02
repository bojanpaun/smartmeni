import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../context/PlatformContext'

// Zaštita osjetljivih/izlaznih akcija u demo režimu (javni „Isprobaj demo" objekat).
// Vraća funkciju koja — ako je tenant demo — pokaže toast i vrati `true` (blokirano);
// pozivalac tada prekida akciju: `if (demoGuard()) return`.
// Napomena: demo kredencijali su dijeljeni, pa je ovo UI-nivo zaštita; potpuni backstop
// je noćni reset (reset_demo_tenant vraća lozinku i briše podatke).
export function useDemoGuard() {
  const { isDemo } = usePlatform()
  const { t } = useTranslation('admin')
  return () => {
    if (!isDemo) return false
    toast.error(t('demoBlocked'))
    return true
  }
}
