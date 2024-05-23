/* eslint-disable i18next/no-literal-string */
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
  viewType: "exercise-editor"
  exerciseTaskId: string
  repositoryExercises: Array<RepositoryExercise> | null
  privateSpec: PrivateSpec | null
}

export type AnswerExerciseState = {
  viewType: "answer-exercise"
  initialPublicSpec: PublicSpec
  userAnswer: UserAnswer
  previousSubmission: ExerciseTaskSubmission | null
}

export type ViewSubmissionState = {
  viewType: "view-submission"
  exerciseTaskId: string
  grading: ExerciseTaskGradingResult | null
  submission: UserAnswer
  publicSpec: PublicSpec
  modelSolutionSpec: ModelSolutionSpec | null
}

export type PrivateSpec = {
  type: "browser" | "editor"
  repositoryExercise: RepositoryExercise
}

export type PublicSpec = BrowserExercisePublicSpec | EditorExercisePublicSpec

export interface BrowserExercisePublicSpec {
  type: "browser"
  files: Array<ExerciseFile>
}

export interface EditorExercisePublicSpec {
  type: "editor"
  archiveName: string
  archiveDownloadUrl: string
  checksum: string
}

export type MessageToParent =
  | Exclude<MessageFromIframe, CurrentStateMessage>
  | (Omit<CurrentStateMessage, "data"> & {
      data: CurrentStateMessageData
    })

export type CurrentStateMessageData =
  | { private_spec: PrivateSpec | UserAnswer }
  | { public_spec: PublicSpec }

export type UserAnswer = BrowserAnswer | EditorAnswer

export interface BrowserAnswer {
  type: "browser"
  files: Array<ExerciseFile>
}

export interface EditorAnswer {
  type: "editor"
  archiveDownloadUrl: string
}

export type ModelSolutionSpec = BrowserExerciseModelSolutionSpec | EditorExerciseModelSolutionSpec

export interface BrowserExerciseModelSolutionSpec {
  type: "browser"
  solutionFiles: Array<ExerciseFile>
}

export interface EditorExerciseModelSolutionSpec {
  type: "editor"
  downloadUrl: string
}

export interface ExerciseFile {
  filepath: string
  contents: string
}
