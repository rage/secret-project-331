"use client"

import { useQuery } from "@tanstack/react-query"
import { useRef } from "react"

import {
  getCourseMaterialExerciseOptions,
  getCourseMaterialExerciseQueryKey,
} from "@/generated/course-material-api/@tanstack/react-query.generated"
import type { CourseMaterialExercise } from "@/generated/course-material-api/types.generated"

/** How long to keep polling an automatic grading that stays pending, e.g. one lost in a restart. */
const GRADING_POLL_LIMIT_MS = 10 * 60 * 1000

/**
 * Whether an automatic grading of the student's latest answer is still running. Manual review
 * (`PendingManual`) is not: it waits for a person, so polling would not bring it sooner.
 */
export function isGradingPending(exercise: CourseMaterialExercise | undefined): boolean {
  return (
    exercise?.exercise_status?.grading_progress === "Pending" ||
    (exercise?.current_exercise_slide.exercise_tasks.some(
      (task) => task.previous_submission_grading?.grading_progress === "Pending",
    ) ??
      false)
  )
}

/**
 * Milliseconds until the next refetch while a grading has been pending for `pendingForMs`, or
 * false once it is time to give up. Most gradings finish within seconds, so the first polls are
 * close together.
 */
export function gradingPollDelay(pendingForMs: number): number | false {
  if (pendingForMs >= GRADING_POLL_LIMIT_MS) {
    return false
  }
  if (pendingForMs < 1000) {
    return 1000
  }
  if (pendingForMs < 3000) {
    return 2000
  }
  if (pendingForMs < 6000) {
    return 3000
  }
  return 5000
}

/**
 * The exercise as the course material shows it. With `pollPendingGrading`, refetched while an
 * automatic grading is pending; pass it only while the result is on screen, because a refetch
 * that brings the grading also puts the block back into its submission view.
 */
const useCourseMaterialExerciseQuery = (
  exerciseId: string,
  showExercise: boolean,
  pollPendingGrading = false,
) => {
  const pendingSinceRef = useRef<number | null>(null)
  const getCourseMaterialExercise = useQuery({
    ...getCourseMaterialExerciseOptions({
      path: {
        exercise_id: exerciseId,
      },
    }),
    enabled: showExercise,
    select: (data): CourseMaterialExercise => data,
    refetchInterval: (query) => {
      if (!pollPendingGrading || !isGradingPending(query.state.data)) {
        pendingSinceRef.current = null
        return false
      }
      const now = Date.now()
      pendingSinceRef.current ??= now
      const delay = gradingPollDelay(now - pendingSinceRef.current)
      if (delay === false) {
        // A later submission starts a new window.
        pendingSinceRef.current = null
      }
      return delay
    },
  })
  return getCourseMaterialExercise
}

export const courseMaterialExerciseQueryKey = (id: string) =>
  getCourseMaterialExerciseQueryKey({
    path: {
      exercise_id: id,
    },
  })

export default useCourseMaterialExerciseQuery
