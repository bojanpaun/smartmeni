import { supabase } from './supabase'

export function getImageUrl(bucket, path) {
  if (!path) return null
  if (path.startsWith('http')) return path
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data?.publicUrl ?? null
}
