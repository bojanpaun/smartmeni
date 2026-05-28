import toast from 'react-hot-toast'

const KNOWN_ERRORS = {
  'JWT expired': 'Sesija je istekla. Prijavite se ponovo.',
  'Invalid login credentials': 'Pogrešan email ili lozinka.',
  'Email not confirmed': 'Email adresa nije potvrđena.',
  'User already registered': 'Korisnik s ovim emailom već postoji.',
  'duplicate key value': 'Ovaj unos već postoji.',
  'violates foreign key constraint': 'Operacija nije moguća — postoje povezani podaci.',
  'violates not-null constraint': 'Sva obavezna polja moraju biti popunjena.',
}

export function handleSupabaseError(error, fallback = 'Došlo je do greške. Pokušajte ponovo.') {
  if (!error) return
  const msg = Object.entries(KNOWN_ERRORS).find(([key]) => error.message?.includes(key))?.[1] ?? fallback
  toast.error(msg)
  if (import.meta.env.DEV) console.error('[Supabase error]', error)
}

export async function safeQuery(queryFn, { onSuccess, onError, successMsg } = {}) {
  try {
    const { data, error } = await queryFn()
    if (error) throw error
    if (successMsg) toast.success(successMsg)
    onSuccess?.(data)
    return { data, error: null }
  } catch (err) {
    handleSupabaseError(err)
    onError?.(err)
    return { data: null, error: err }
  }
}
