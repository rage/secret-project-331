import { ExerciseTaskGradingResult } from "@/shared-module/common/bindings"
import { RunResult } from "@/tmc/cli"
import { ExerciseFile, ExerciseIframeState, PublicSpec } from "@/util/stateInterfaces"

export interface AnswerBrowserExerciseProps {
  publicSpec: PublicSpec
  initialState: Array<ExerciseFile>
  testRequestResponse: RunResult | null
  setState: (updater: (state: ExerciseIframeState | null) => ExerciseIframeState | null) => void
  /** Shown after submit so user sees result and can continue trying */
  grading?: ExerciseTaskGradingResult | null
  /** When true (e.g. after submit), editor is read-only */
  readOnly?: boolean
}
