import {
  answerExerciseState,
  customViewState,
  DEFAULT_USER_INFO,
  DEFAULT_USER_INFORMATION,
  exerciseEditorState,
  viewSubmissionState,
  ZERO_UUID,
} from "../src/protocol/stateBuilders"

describe("state builders", () => {
  test("answerExerciseState fills envelope defaults and passes data through", () => {
    const state = answerExerciseState({ public_spec: [{ id: "a", name: "A" }] })
    expect(state.view_type).toBe("answer-exercise")
    expect(state.exercise_task_id).toBe(ZERO_UUID)
    expect(state.user_information).toEqual(DEFAULT_USER_INFORMATION)
    expect(state.user_variables).toEqual({})
    expect(state.data.public_spec).toEqual([{ id: "a", name: "A" }])
    expect(state.data.previous_submission).toBeNull()
  })

  test("answerExerciseState honours explicit overrides", () => {
    const state = answerExerciseState({
      public_spec: [],
      previous_submission: { selectedOptionId: "x" },
      exercise_task_id: "task-1",
      user_information: { pseudonymous_id: "someone", signed_in: true },
    })
    expect(state.exercise_task_id).toBe("task-1")
    expect(state.user_information).toEqual({ pseudonymous_id: "someone", signed_in: true })
    expect(state.data.previous_submission).toEqual({ selectedOptionId: "x" })
  })

  test("exerciseEditorState omits repository_exercises unless provided", () => {
    const bare = exerciseEditorState({ private_spec: [{ id: "a", name: "A", correct: true }] })
    expect(bare.view_type).toBe("exercise-editor")
    expect(bare.data.private_spec).toEqual([{ id: "a", name: "A", correct: true }])
    expect("repository_exercises" in bare).toBe(false)

    const withRepo = exerciseEditorState({ private_spec: [], repository_exercises: [] })
    expect(withRepo.repository_exercises).toEqual([])
  })

  test("viewSubmissionState defaults grading and model solution to null", () => {
    const state = viewSubmissionState({
      public_spec: [{ id: "a", name: "A" }],
      user_answer: { selectedOptionId: "a" },
    })
    expect(state.view_type).toBe("view-submission")
    expect(state.data.grading).toBeNull()
    expect(state.data.model_solution_spec).toBeNull()
    expect(state.data.user_answer).toEqual({ selectedOptionId: "a" })
  })

  test("customViewState uses UserInfo defaults and has no exercise_task_id", () => {
    const state = customViewState({ submissions_by_exercise: [] })
    expect(state.view_type).toBe("custom-view")
    expect(state.user_information).toEqual(DEFAULT_USER_INFO)
    expect(state.course_name).toBe("Test course")
    expect(state.module_completion_date).toBeNull()
    expect("exercise_task_id" in state).toBe(false)
  })
})
