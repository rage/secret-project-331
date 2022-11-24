/* eslint-disable i18next/no-literal-string */
import {
  ExerciseTaskGradingResult,
  ExerciseTaskSubmission,
  RepositoryExercise,
} from "../shared-module/bindings"

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
  publicSpec: PublicSpec
  previousSubmission: ExerciseTaskSubmission | null
}

export type ViewSubmissionState = {
  viewType: "view-submission"
  exerciseTaskId: string
  grading: ExerciseTaskGradingResult | null
  userAnswer: UserAnswer
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
  files: Array<[string, string]>
}

export interface EditorExercisePublicSpec {
  type: "editor"
  archiveName: string
  archiveDownloadUrl: string
}

export type Submission = BrowserSubmission | EditorSubmission

export interface BrowserSubmission {
  type: "browser"
  files: Array<[string, string]>
}

export interface EditorSubmission {
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
  fileName: string
  fileContents: string
}

export type UserAnswer = BrowserExerciseUserAnswer | EditorExerciseUserAnswer

export interface BrowserExerciseUserAnswer {
  type: "browser"
  fileContents: string
}

export interface EditorExerciseUserAnswer {
  type: "editor"
  answerFiles: [ExerciseFile]
}
