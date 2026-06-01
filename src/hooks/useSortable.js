import { useState, useCallback } from 'react'

const PRIORITY_ORDER = { urgent: 4, high: 3, normal: 2, low: 1 }

function getValue(obj, key) {
  const val = key.split('.').reduce((o, k) => (o != null && o[k] !== undefined ? o[k] : null), obj)
  // Priority columns sort numerically
  if (key === 'priority' || key.endsWith('.priority')) return PRIORITY_ORDER[val] ?? 0
  return val
}

export function useSortable(defaultCol = null, defaultDir = 'asc') {
  const [sortBy, setSortBy] = useState(defaultCol)
  const [sortDir, setSortDir] = useState(defaultDir)

  const onSort = useCallback((col) => {
    setSortBy(prev => {
      if (prev === col) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        return prev
      }
      setSortDir('asc')
      return col
    })
  }, [])

  const sort = useCallback((data) => {
    if (!sortBy || !data || !data.length) return data
    return [...data].sort((a, b) => {
      const av = getValue(a, sortBy)
      const bv = getValue(b, sortBy)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = typeof av === 'string'
        ? av.localeCompare(bv, 'sr-Latn', { sensitivity: 'base' })
        : av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [sortBy, sortDir])

  return { sortBy, sortDir, onSort, sort }
}
