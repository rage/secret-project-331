import type {
  CurrentStateMessage,
  MessageFromIframe,
} from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import type {
  ExerciseTaskGradingResult,
  ExerciseTaskSubmission,
  RepositoryExercise,
} from "@/util/exerciseServiceApi"

export type ExerciseIframeState = ExerciseEditorState | AnswerExerciseState | ViewSubmissionState

export interface ExerciseEditorState {
  view_type: "exercise-editor"
  exercise_task_id: string
  repository_exercises: RepositoryExercise[] | null
  private_spec: PrivateSpec | null
}

export interface AnswerExerciseState {
  view_type: "answer-exercise"
  public_spec: PublicSpec
  user_answer: UserAnswer
  previous_submission: ExerciseTaskSubmission | null
}

export interface ViewSubmissionState {
  view_type: "view-submission"
  exercise_task_id: string
  grading: ExerciseTaskGradingResult | null
  submission: UserAnswer
  public_spec: PublicSpec
  model_solution_spec: ModelSolutionSpec | null
}

export interface PrivateSpec {
  type: "browser" | "editor"
  repository_exercise: RepositoryExercise
}

/** In-browser test config: script to run in the client and optional error if build failed. */
export interface BrowserTestSpec {
  runtime: "python"
  script: string
  /** Set when script build failed (e.g. template missing test/ or tmc/). */
  error?: string
}

export interface PublicSpec {
  type: "browser" | "editor"
  archive_name: string
  stub_download_url: string
  student_file_paths: string[]
  checksum: string
  /** In-browser test: script + runtime. Omitted for editor or when no script is built. */
  browser_test?: BrowserTestSpec
}

export interface ModelSolutionSpec {
  solution_download_url: string
}

export type MessageToParent =
  | Exclude<MessageFromIframe, CurrentStateMessage>
  | (Omit<CurrentStateMessage, "data"> & {
      data: CurrentStateMessageData
    })

export type CurrentStateMessageData =
  | { private_spec: PrivateSpec | UserAnswer }
  | { public_spec: PublicSpec }

export type UserAnswer = BrowserUserAnswer | EditorUserAnswer

export interface BrowserUserAnswer {
  type: "browser"
  files: ExerciseFile[]
}

export interface EditorUserAnswer {
  type: "editor"
  archive_download_url: string
}

export interface ExerciseFile {
  filepath: string
  contents: string
}
