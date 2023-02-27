/* eslint-disable i18next/no-literal-string */
import {
  ExerciseTaskGradingResult,
  ExerciseTaskSubmission,
  RepositoryExercise,
} from "../shared-module/bindings"
import { CurrentStateMessage } from "../shared-module/exercise-service-protocol-types"

export const playgroundPublicSpecUploadUrl = "http://project-331.local/api/v0/files/playground"
export const publicSpecUploadUrl = "http://project-331.local/api/v0/files/tmc"
export const publicSpecDownloadUrlRoot = "http://project-331.local/api/v0/files/"

export type IframeState = ExerciseEditorState | AnswerExerciseState | ViewSubmissionState

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
}

export type IframeMessage = CurrentStateMessage & {
  data: { private_spec: PrivateSpec } | { public_spec: PublicSpec } | { user_answer: UserAnswer }
}

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
