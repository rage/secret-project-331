import {
  ExerciseTaskGradingResult,
  ExerciseTaskSubmission,
  RepositoryExercise,
} from "@/shared-module/common/bindings"
import {
  CurrentStateMessage,
  MessageFromIframe,
} from "@/shared-module/common/exercise-service-protocol-types"

export type ExerciseIframeState = ExerciseEditorState | AnswerExerciseState | ViewSubmissionState

export type ExerciseEditorState = {
  view_type: "exercise-editor"
  exercise_task_id: string
  repository_exercises: Array<RepositoryExercise> | null
  private_spec: PrivateSpec | null
}

export type AnswerExerciseState = {
  view_type: "answer-exercise"
  public_spec: PublicSpec
  user_answer: UserAnswer
  previous_submission: ExerciseTaskSubmission | null
}

export type ViewSubmissionState = {
  view_type: "view-submission"
  exercise_task_id: string
  grading: ExerciseTaskGradingResult | null
  submission: UserAnswer
  public_spec: PublicSpec
  model_solution_spec: ModelSolutionSpec | null
}

export type PrivateSpec = {
  type: "browser" | "editor"
  repository_exercise: RepositoryExercise
}

export type PublicSpec = {
  type: "browser" | "editor"
  archive_name: string
  stub_download_url: string
  student_file_paths: Array<string>
  checksum: string
}

export type ModelSolutionSpec = {
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

export type BrowserUserAnswer = {
  type: "browser"
  files: Array<ExerciseFile>
}

export type EditorUserAnswer = {
  type: "editor"
  archive_download_url: string
}

export type ExerciseFile = {
  filepath: string
  contents: string
}
