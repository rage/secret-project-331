import type { RunResult } from "@/tmc/cli"
import type { ExerciseTaskGradingResult } from "@/util/exerciseServiceApi"
import type { ExerciseFile, PublicSpec } from "@/util/stateInterfaces"

export interface AnswerBrowserExerciseProps {
  publicSpec: PublicSpec
  initialState: ExerciseFile[]
  /** What Reset restores: the exercise's starting code. Null hides Reset. */
  startingFiles: ExerciseFile[] | null
  testRequestResponse: RunResult | null
  /** Called with the edited files; omit when the editor is only displaying them. */
  onFilesChange?: ((files: ExerciseFile[]) => void) | undefined
  /** Shown after submit so user sees result and can continue trying */
  grading?: ExerciseTaskGradingResult | null | undefined
  /** When true (e.g. after submit), editor is read-only */
  readOnly?: boolean
}
