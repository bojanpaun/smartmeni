export function toEmbedUrl(url) {
  if (!url) return ''
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vm = url.match(/(?:vimeo\.com\/)(\d+)/)
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`
  return url
}
