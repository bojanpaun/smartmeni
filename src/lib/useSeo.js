import { useEffect } from 'react'

// Minimalni per-stranica SEO za javne SPA rute (nema SSR/react-helmet): postavlja
// document.title + <meta name="description"> dok je stranica montirana, i vraća
// prethodno stanje na unmount (da admin/druge rute ne naslijede tuđi naslov).
// Napomena: og:/social scraperi ne izvršavaju JS pa ovo pomaže tab-naslovu i
// osnovnom SEO-u (Google izvršava JS), ne social preview-u — za to bi trebao SSR.
export function useSeo(title, description) {
  useEffect(() => {
    if (!title) return undefined
    const prevTitle = document.title
    document.title = title

    let meta = document.querySelector('meta[name="description"]')
    const created = !meta
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    const prevDesc = meta.getAttribute('content')
    if (description) meta.setAttribute('content', description)

    return () => {
      document.title = prevTitle
      if (created) meta.remove()
      else if (description) meta.setAttribute('content', prevDesc || '')
    }
  }, [title, description])
}
