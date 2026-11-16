import { useEffect } from "react"

import { focusProgrammatically } from "@/shared-module/components"

let pendingExerciseId: string | null = null

export const getPeerReviewHeadingId = (exerciseId: string) =>
  // oxlint-disable-next-line i18next/no-literal-string
  `peer-review-heading-${exerciseId}`

export const focusPeerReviewHeading = (exerciseId: string): boolean => {
  // oxlint-disable-next-line unicorn/prefer-query-selector -- id embeds a raw UUID
  const heading = document.getElementById(getPeerReviewHeadingId(exerciseId))
  if (!heading) {
    return false
  }
  focusProgrammatically(heading)
  pendingExerciseId = null
  return true
}

/** Marks that the heading should take focus, also when it mounts later (view swapped out). */
export const requestPeerReviewHeadingFocus = (exerciseId: string) => {
  pendingExerciseId = exerciseId
}

/** Focuses the heading if a submit or report asked for it, on mount and when `trigger` changes. */
export const usePendingPeerReviewHeadingFocus = (exerciseId: string, trigger = 0) => {
  useEffect(() => {
    if (pendingExerciseId === exerciseId) {
      focusPeerReviewHeading(exerciseId)
    }
  }, [exerciseId, trigger])
}
