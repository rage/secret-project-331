import { parseISO } from "date-fns"
import { useMemo } from "react"

export const useDateStringAsDateNullable = (dateString: string | null | undefined): Date | null => {
  const date = useMemo(() => {
    if (dateString) {
      return parseISO(dateString)
    }
    return null
  }, [dateString])
  return date
}

export const useDateStringAsDate = (dateString: string): Date => {
  const date = useMemo(() => {
    return parseISO(dateString)
  }, [dateString])
  return date
}
