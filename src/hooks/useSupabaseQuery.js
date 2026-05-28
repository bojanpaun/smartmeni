import { useState, useEffect, useCallback } from 'react'
import { handleSupabaseError } from '../lib/handleError'

export function useSupabaseQuery(queryFn, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const execute = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: result, error: err } = await queryFn()
      if (err) throw err
      setData(result)
    } catch (err) {
      setError(err)
      handleSupabaseError(err)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { execute() }, [execute])

  return { data, loading, error, refetch: execute }
}
