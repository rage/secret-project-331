"use client"
import { isAfter, parseISO } from "date-fns"
import { useAtomValue } from "jotai"
import { useMemo } from "react"

import { courseMaterialAtom } from "@/state/course-material"

const useHasCourseClosed = () => {
  const courseMaterialState = useAtomValue(courseMaterialAtom)

  const closedAtIso =
    courseMaterialState.status === "ready" ? courseMaterialState.course?.closed_at : undefined

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
