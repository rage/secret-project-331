import type {
  CourseMaterialExercise,
  CourseMaterialExerciseTask,
} from "@/generated/course-material-api/types.generated"

import exerciseBlockPostThisStateToIFrameReducer from "../exerciseBlockPostThisStateToIFrameReducer"

function downloadedExercise(task: Partial<CourseMaterialExerciseTask>): CourseMaterialExercise {
  return {
    current_exercise_slide: {
      exercise_tasks: [
        {
          id: "task-1",
          order_number: 0,
          exercise_service_slug: "quizzes",
          public_spec: { public: true },
          pseudonumous_user_id: "pseudonymous-1",
          ...task,
        },
      ],
    },
    user_course_instance_exercise_service_variables: [],
  } as unknown as CourseMaterialExercise
}

const SUBMISSION = { data_json: { selected: "a" } }
const GRADING = {
  grading_progress: "FullyGraded",
  unscaled_score_given: 1,
  unscaled_score_maximum: 1,
  feedback_text: null,
  feedback_json: null,
}

function download(task: Partial<CourseMaterialExerciseTask>) {
  return {
    type: "exerciseDownloaded" as const,
    payload: downloadedExercise(task),
    signedIn: true,
    isChapterLocked: false,
  }
}

describe("exerciseBlockPostThisStateToIFrameReducer", () => {
  it("takes grading from a refetch while a submission is shown", () => {
    const hidden = exerciseBlockPostThisStateToIFrameReducer(
      null,
      download({ previous_submission: SUBMISSION as never }),
    )
    const shown = exerciseBlockPostThisStateToIFrameReducer(
      hidden,
      download({
        previous_submission: SUBMISSION as never,
        previous_submission_grading: GRADING as never,
      }),
    )

    expect(shown).toMatchObject([
      { view_type: "view-submission", data: { grading: { score_given: 1 } } },
    ])
  })

  it("returns to answering when a refetch has no submission", () => {
    const viewing = exerciseBlockPostThisStateToIFrameReducer(
      null,
      download({ previous_submission: SUBMISSION as never }),
    )
    const reset = exerciseBlockPostThisStateToIFrameReducer(viewing, download({}))

    expect(reset).toMatchObject([{ view_type: "answer-exercise" }])
  })
})
