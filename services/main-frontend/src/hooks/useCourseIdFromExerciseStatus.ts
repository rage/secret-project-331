import type { ExerciseStatusSummaryForUser } from "@/generated/api/types.generated"

export const useCourseIdFromExerciseStatus = (
  exerciseStatusSummaries: ExerciseStatusSummaryForUser[] | undefined,
): string | null => {
  if (!exerciseStatusSummaries) {
    return null
  }
  const first = exerciseStatusSummaries[0]
  if (!first) {
    return null
  }
  return first.exercise.course_id ?? null
}
