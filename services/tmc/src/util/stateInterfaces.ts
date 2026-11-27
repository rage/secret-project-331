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
  /**
   * The repository exercise the teacher picked in this editor session. Unset until they pick one:
   * a copied course's private spec still names the source course's exercise, which must not
   * replace the host's own record of the task's exercise.
   */
  picked_repository_exercise_id?: string
}

export interface AnswerExerciseState {
  view_type: "answer-exercise"
  public_spec: PublicSpec
  /** The student's working copy in browser mode: student files only, main file first. */
  editor_files: ExerciseFile[]
  /**
   * The stub's student files, which Reset returns to. Empty in editor mode; null when the stub
   * could not be downloaded, which leaves no Reset.
   */
  starting_files: ExerciseFile[] | null
  /** Where {@link editor_files} are drafted locally; null when signed out or in editor mode. */
  draft: { key: string; basis: string } | null
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
  /** Set once the student may see the model solution. */
  model_solution_spec: ModelSolutionSpec | null
  /** Source files of the model solution; empty until its archive has been read. */
  model_solution_files: ExerciseFile[]
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
  /** The exercise's `tests_timeout_ms`, counted from when Python has loaded. Absent in older stored specs. */
  timeout_ms?: number
}

export interface PublicSpec {
  type: "browser" | "editor"
  archive_name: string
  stub_download_url: string
  /**
   * The stub's student files, sorted by path. Stored specs may list them unsorted or name
   * directories, so read it through `isStudentFile`.
   */
  student_file_paths: string[]
  checksum: string
  /** In-browser test: script + runtime. Omitted for editor or when no script is built. */
  browser_test?: BrowserTestSpec
  /** The student file the browser editor opens. Optional: stored specs may lack it. */
  main_file?: string
  /**
   * Top-level directory of the archive a browser answer is packed into, stable per exercise like the
   * exercise directory of a VS Code answer. Optional: stored specs may lack it.
   */
  archive_prefix?: string
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
