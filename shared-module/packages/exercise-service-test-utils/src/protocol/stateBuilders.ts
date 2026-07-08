// Typed builders for the `set-state` payloads a host pushes to a plugin. They fill in the envelope
// (exercise_task_id, user_information, user_variables) with test defaults so specs only supply the
// view-specific `data`. Pass any field explicitly to override a default.
//
// The returned object is the `ExtendedIframeState` (no `message` field) — feed it to the browser
// emulator's `setStateRaw` / the Playwright wrapper's `setState`.

import type {
  AnswerExerciseIframeState,
  CustomViewIframeState,
  ExerciseEditorIframeState,
  UserInformation,
  UserVariablesMap,
  ViewSubmissionIframeState,
} from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import type {
  ExerciseTaskGradingResult,
  RepositoryExercise,
  UserInfo,
} from "@/shared-module/exercise-protocol/core/exerciseServiceTypes"

/** All-zero UUID used as the default `exercise_task_id` in tests. */
export const ZERO_UUID = "00000000-0000-0000-0000-000000000000"

/** Default `user_information` for the exercise views (pseudonymous, not signed in). */
export const DEFAULT_USER_INFORMATION: UserInformation = {
  pseudonymous_id: "test-user",
  signed_in: false,
}

/** Default `user_information` for the custom view (a different `UserInfo` shape). */
export const DEFAULT_USER_INFO: UserInfo = {
  user_id: "00000000-0000-0000-0000-000000000001",
  first_name: null,
  last_name: null,
}

interface AnswerExerciseInput {
  public_spec: unknown
  previous_submission?: unknown | null
  exercise_task_id?: string
  user_information?: UserInformation
  user_variables?: UserVariablesMap | null
}

/** Build an `answer-exercise` state (student view). */
export function answerExerciseState(input: AnswerExerciseInput): AnswerExerciseIframeState {
  return {
    view_type: "answer-exercise",
    exercise_task_id: input.exercise_task_id ?? ZERO_UUID,
    user_information: input.user_information ?? DEFAULT_USER_INFORMATION,
    user_variables: input.user_variables ?? {},
    data: {
      public_spec: input.public_spec,
      previous_submission: input.previous_submission ?? null,
    },
  }
}

interface ExerciseEditorInput {
  private_spec: unknown
  exercise_task_id?: string
  user_information?: UserInformation
  repository_exercises?: Array<RepositoryExercise>
}

/** Build an `exercise-editor` state (teacher view). */
export function exerciseEditorState(input: ExerciseEditorInput): ExerciseEditorIframeState {
  const state: ExerciseEditorIframeState = {
    view_type: "exercise-editor",
    exercise_task_id: input.exercise_task_id ?? ZERO_UUID,
    user_information: input.user_information ?? DEFAULT_USER_INFORMATION,
    data: { private_spec: input.private_spec },
  }
  if (input.repository_exercises !== undefined) {
    state.repository_exercises = input.repository_exercises
  }
  return state
}

interface ViewSubmissionInput {
  public_spec: unknown
  user_answer: unknown
  model_solution_spec?: unknown
  grading?: ExerciseTaskGradingResult | null
  exercise_task_id?: string
  user_information?: UserInformation
  user_variables?: UserVariablesMap | null
}

/** Build a `view-submission` state (read-only, with optional grading + model solution). */
export function viewSubmissionState(input: ViewSubmissionInput): ViewSubmissionIframeState {
  return {
    view_type: "view-submission",
    exercise_task_id: input.exercise_task_id ?? ZERO_UUID,
    user_information: input.user_information ?? DEFAULT_USER_INFORMATION,
    user_variables: input.user_variables ?? {},
    data: {
      grading: input.grading ?? null,
      user_answer: input.user_answer,
      public_spec: input.public_spec,
      model_solution_spec: input.model_solution_spec ?? null,
    },
  }
}

interface CustomViewInput {
  submissions_by_exercise: CustomViewIframeState["data"]["submissions_by_exercise"]
  course_name?: string
  module_completion_date?: string | null
  user_information?: UserInfo
  user_variables?: UserVariablesMap | null
}

/** Build a `custom-view` state (per-course custom view; distinct `UserInfo`, no exercise_task_id). */
export function customViewState(input: CustomViewInput): CustomViewIframeState {
  return {
    view_type: "custom-view",
    user_information: input.user_information ?? DEFAULT_USER_INFO,
    user_variables: input.user_variables ?? {},
    course_name: input.course_name ?? "Test course",
    module_completion_date: input.module_completion_date ?? null,
    data: { submissions_by_exercise: input.submissions_by_exercise },
  }
}
