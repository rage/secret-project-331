"use client"
import { isAfter, parseISO } from "date-fns"
import { useContext, useMemo } from "react"

import PageContext from "@/contexts/PageContext"

const useHasCourseClosed = () => {
  const pageContext = useContext(PageContext)

  const closedAtIso = pageContext.state === "ready" ? pageContext.course?.closed_at : undefined

  const hasClosed = useMemo(() => {
    if (!closedAtIso) {
      return false
    }
    const closedAt = parseISO(closedAtIso)
    return isAfter(new Date(), closedAt)
  }, [closedAtIso])

  return hasClosed
}

export default useHasCourseClosed
