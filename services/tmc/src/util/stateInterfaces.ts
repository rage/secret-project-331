import {
  ExerciseTaskGradingResult,
  ExerciseTaskSubmission,
  RepositoryExercise,
} from "../shared-module/bindings"

export type State =
  | {
      viewType: "answer-exercise"
      exerciseTaskId: string
      publicSpec: PublicSpec
      previousSubmission: ExerciseTaskSubmission | null
    }
  | {
      viewType: "view-submission"
      exerciseTaskId: string
      grading: ExerciseTaskGradingResult | null
      userAnswer: UserAnswer
      publicSpec: PublicSpec
      modelSolutionSpec: ModelSolutionSpec | null
    }
  | {
      viewType: "exercise-editor"
      exerciseTaskId: string
      privateSpec: PrivateSpec | null
      selectedRepositoryExercise: RepositoryExercise | null
    }

export type PublicSpec = BrowserExercisePublicSpec | EditorExercisePublicSpec

export interface BrowserExercisePublicSpec {
  type: "browser"
  initialContents: string
  currentContents: string
}

export interface EditorExercisePublicSpec {
  type: "editor"
}

export type PrivateSpec = {
  type: "browser" | "editor"
  repository_exercise_id: string
}

export type ModelSolutionSpec = BrowserExerciseModelSolutionSpec | EditorExerciseModelSolutionSpec

export interface BrowserExerciseModelSolutionSpec {
  type: "browser"
  fileContents: string
}

export interface EditorExerciseModelSolutionSpec {
  type: "editor"
  solutionFiles: [ExerciseFile]
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
