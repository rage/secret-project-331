import type {
  CourseMaterialExercise,
  GradingProgress,
} from "@/generated/course-material-api/types.generated"

import { gradingPollDelay, isGradingPending } from "../useCourseMaterialExerciseQuery"

function exercise(
  statusProgress: GradingProgress | null,
  taskProgresses: (GradingProgress | null)[] = [],
): CourseMaterialExercise {
  return {
    exercise_status:
      statusProgress === null
        ? null
        : {
            activity_progress: "Submitted",
            grading_progress: statusProgress,
            reviewing_stage: "NotStarted",
          },
    current_exercise_slide: {
      exercise_tasks: taskProgresses.map((progress) => ({
        previous_submission_grading: progress === null ? null : { grading_progress: progress },
      })),
    },
  } as unknown as CourseMaterialExercise
}

describe("isGradingPending", () => {
  it("is pending while the exercise or one of its tasks awaits automatic grading", () => {
    expect(isGradingPending(exercise("Pending"))).toBe(true)
    expect(isGradingPending(exercise("NotReady", ["FullyGraded", "Pending"]))).toBe(true)
  })

  it("is not pending once graded, before any answer, or while waiting for a person", () => {
    expect(isGradingPending(exercise("FullyGraded", ["FullyGraded"]))).toBe(false)
    expect(isGradingPending(exercise(null))).toBe(false)
    expect(isGradingPending(exercise("PendingManual", ["PendingManual"]))).toBe(false)
    expect(isGradingPending(undefined)).toBe(false)
  })
})

describe("gradingPollDelay", () => {
  it("polls quickly at first, then every five seconds", () => {
    expect(gradingPollDelay(0)).toBe(1000)
    expect(gradingPollDelay(1000)).toBe(2000)
    expect(gradingPollDelay(3000)).toBe(3000)
    expect(gradingPollDelay(6000)).toBe(5000)
    expect(gradingPollDelay(9 * 60 * 1000)).toBe(5000)
  })

  it("gives up after ten minutes", () => {
    expect(gradingPollDelay(10 * 60 * 1000)).toBe(false)
  })
})
