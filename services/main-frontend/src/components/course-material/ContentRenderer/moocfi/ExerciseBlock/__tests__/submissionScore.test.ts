import type { StudentExerciseSlideSubmissionResult } from "@/generated/course-material-api/types.generated"

import { getSubmissionScore } from "../submissionScore"

const result = (
  taskScores: (number | null)[],
  best: number | null,
): StudentExerciseSlideSubmissionResult =>
  ({
    exercise_status: { score_given: best },
    exercise_task_submission_results: taskScores.map((score_given) => ({
      grading: { score_given },
    })),
    user_course_instance_exercise_service_variables: [],
  }) as unknown as StudentExerciseSlideSubmissionResult

describe("getSubmissionScore", () => {
  it("uses this submission's score, not the best score", () => {
    expect(getSubmissionScore(result([0], 1))).toBe(0)
  })

  it("sums the task gradings", () => {
    expect(getSubmissionScore(result([0.5, 0.25], 1))).toBe(0.75)
  })

  it("falls back to the best score when a task is not graded yet", () => {
    expect(getSubmissionScore(result([null], 1))).toBe(1)
  })
})
