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
  /** The student's working copy in browser mode; always empty in editor mode. */
  editor_files: ExerciseFile[]
  /**
   * Host file id of the archive the answer consists of, or null while no upload matches
   * {@link editor_files}. Null means the answer is not submittable yet.
   */
  uploaded_archive_id: string | null
  previous_submission: ExerciseTaskSubmission | null
}

export interface ViewSubmissionState {
  view_type: "view-submission"
  exercise_task_id: string
  grading: ExerciseTaskGradingResult | null
  /** Source files of the submitted archive; empty when it could not be read. */
  submitted_files: ExerciseFile[]
  /** Where the submitted archive can be downloaded, or null when the submission named no files. */
  submitted_archive_url: string | null
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

/**
 * Mirrored by `ModelSolutionSpec` in tmc-langs-rust
 * (`crates/tmc-mooc-client/src/exercise.rs`), which deserializes this blob for
 * native clients. `type` is the discriminant that keeps it self-describing
 * outside its task, like {@link PublicSpec}'s; the solution is an uploaded
 * project archive for both types.
 */
export interface ModelSolutionSpec {
  type: "browser" | "editor"
  solution_download_url: string
}

export type MessageToParent =
  | Exclude<MessageFromIframe, CurrentStateMessage>
  | (Omit<CurrentStateMessage, "data"> & {
      data: CurrentStateMessageData
    })

/** `null` for an answer: a tmc answer is its archive and carries no metadata about it. */
export type CurrentStateMessageData =
  | { private_spec: PrivateSpec }
  | { public_spec: PublicSpec }
  | null

export interface ExerciseFile {
  filepath: string
  contents: string
}
