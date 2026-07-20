import type { RunResult } from "@/tmc/cli"
import type { ExerciseTaskGradingResult } from "@/util/exerciseServiceApi"
import type { ExerciseFile, ExerciseIframeState, PublicSpec } from "@/util/stateInterfaces"

export interface AnswerBrowserExerciseProps {
  publicSpec: PublicSpec
  initialState: ExerciseFile[]
  testRequestResponse: RunResult | null
  setState: (updater: (state: ExerciseIframeState | null) => ExerciseIframeState | null) => void
  /** Shown after submit so user sees result and can continue trying */
  grading?: ExerciseTaskGradingResult | null | undefined
  /** When true (e.g. after submit), editor is read-only */
  readOnly?: boolean
}
