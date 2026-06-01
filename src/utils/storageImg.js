// Supabase Storage Image Transformation
// Zamjenjuje /object/public/ sa /render/image/public/ + query params
// Radi samo za slike iz Supabase Storage — vanjski URL-ovi se vraćaju nepromijenjeni

export function storageImg(url, { width = 1200, quality = 80 } = {}) {
  if (!url || typeof url !== 'string') return url
  if (!url.includes('/storage/v1/object/public/')) return url
  return url
    .replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
    + `?width=${width}&quality=${quality}&resize=contain`
}

// Thumbnail varijanta za grid i kartice
export function thumbImg(url, size = 400) {
  return storageImg(url, { width: size, quality: 75 })
}
