import type {
  CourseMaterialExercise,
  StudentExerciseSlideSubmissionResult,
} from "@/generated/course-material-api/types.generated"
import exerciseBlockPostThisStateToIFrameReducer from "@/reducers/course-material/exerciseBlockPostThisStateToIFrameReducer"

import { withSubmissionResult } from "../withSubmissionResult"

const EXERCISE = {
  current_exercise_slide: {
    exercise_tasks: [
      {
        id: "task-1",
        order_number: 0,
        exercise_service_slug: "quizzes",
        public_spec: { public: true },
        model_solution_spec: null,
        pseudonumous_user_id: "pseudonymous-1",
        previous_submission: null,
        previous_submission_grading: null,
      },
    ],
  },
  user_course_instance_exercise_service_variables: [],
} as unknown as CourseMaterialExercise

const RESULT = {
  exercise_task_submission_results: [
    {
      submission: { exercise_task_id: "task-1", data_json: { selected: "a" } },
      grading: {
        grading_progress: "FullyGraded",
        unscaled_score_given: 1,
        unscaled_score_maximum: 1,
        feedback_text: null,
        feedback_json: [{ quiz_item_id: null, quiz_item_feedback: "Well done" }],
      },
      model_solution_spec: { solution: true },
      exercise_task_exercise_service_slug: "quizzes",
    },
  ],
  user_course_instance_exercise_service_variables: [],
} as unknown as StudentExerciseSlideSubmissionResult

function downloaded(exercise: CourseMaterialExercise) {
  return {
    type: "exerciseDownloaded" as const,
    payload: exercise,
    signedIn: true,
    isChapterLocked: false,
  }
}

describe("withSubmissionResult", () => {
  it("yields the same iframe state as the graded submission", () => {
    const answering = exerciseBlockPostThisStateToIFrameReducer(null, downloaded(EXERCISE))
    const graded = exerciseBlockPostThisStateToIFrameReducer(answering, {
      type: "submissionGraded",
      payload: RESULT,
      signedIn: true,
    })

    const fromCache = exerciseBlockPostThisStateToIFrameReducer(
      graded,
      downloaded(withSubmissionResult(EXERCISE, RESULT)),
    )

    expect(fromCache).toEqual(graded)
  })
})
