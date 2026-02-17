import { RunResult } from "@/tmc/cli"
import { ExerciseFile, ExerciseIframeState, PublicSpec } from "@/util/stateInterfaces"

export interface AnswerBrowserExerciseProps {
  publicSpec: PublicSpec
  initialState: Array<ExerciseFile>
  testRequestResponse: RunResult | null
  setState: (updater: (state: ExerciseIframeState | null) => ExerciseIframeState | null) => void
}
