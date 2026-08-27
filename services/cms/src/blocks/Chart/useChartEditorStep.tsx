"use client"

import { useState } from "react"

import { dataUrlFromSpec, specDefinesView } from "./chartSpec"

export const STEP_DATA = "data"
export const STEP_METHOD = "method"
export const STEP_AI = "ai"
export const STEP_EDITOR = "editor"

/**
 * Where the teacher is in building the chart. The data, method and AI steps are only passed on the
 * way in; the editor is the final state and the one an already-built chart opens in.
 */
export type ChartEditorStep =
  | typeof STEP_DATA
  | typeof STEP_METHOD
  | typeof STEP_AI
  | typeof STEP_EDITOR

/** Where leaving the AI prompt — by cancelling or by generating a spec — returns to. */
export type AiReturnStep = typeof STEP_METHOD | typeof STEP_EDITOR

/** Steps the teacher passes through before reaching the editor. */
export const GUIDED_STEP_COUNT = 3

const GUIDED_STEP_NUMBERS: Record<ChartEditorStep, number | null> = {
  [STEP_DATA]: 1,
  [STEP_METHOD]: 2,
  [STEP_AI]: 3,
  // The editor is a destination, not a step to get through.
  [STEP_EDITOR]: null,
}

/**
 * The step a block opens on. A spec that describes a chart goes straight to the editor, as does one
 * that isn't valid JSON — that is the teacher's own work, and the editor is where it gets repaired.
 * A block abandoned partway resumes where it got to: after its data file, or at the very start.
 */
export const resolveInitialStep = (spec: string | undefined): ChartEditorStep => {
  if (!spec?.trim()) {
    return STEP_DATA
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(spec)
  } catch {
    return STEP_EDITOR
  }
  if (specDefinesView(parsed)) {
    return STEP_EDITOR
  }
  return dataUrlFromSpec(spec) ? STEP_METHOD : STEP_DATA
}

/**
 * The step's position in the guided flow, or null when it has none. Re-generating with AI reuses
 * the prompt from the editor, outside the guided flow, so it isn't numbered.
 */
export const guidedStepNumber = (
  step: ChartEditorStep,
  aiReturnStep: AiReturnStep,
): number | null => {
  if (step === STEP_AI && aiReturnStep === STEP_EDITOR) {
    return null
  }
  return GUIDED_STEP_NUMBERS[step]
}

interface ChartEditorStepState {
  step: ChartEditorStep
  /** The step's position in the guided flow, or null when it has none. */
  stepNumber: number | null
  /** Total for "step x of y". */
  stepCount: number
  /** The AI prompt was opened from the editor to rewrite an existing chart, outside the flow. */
  isRegenerating: boolean
  goToDataStep: () => void
  goToMethodStep: () => void
  goToEditorStep: () => void
  /** Moves on from the data step, unless the teacher has already moved on by themselves. */
  advanceFromDataStep: () => void
  /** Opens the AI prompt, remembering the step it was opened from. */
  openAiPrompt: () => void
  /** Leaves the AI prompt for the step it was opened from, whether it produced a spec or not. */
  closeAiPrompt: () => void
}

/**
 * Where the teacher is in building the chart, and the ways to move between those steps.
 *
 * Which step the AI prompt returns to is kept here rather than asked of the caller: the prompt is
 * always opened from the step being returned to, and that step is also what separates writing a
 * chart as part of the guided flow from re-generating a finished one.
 */
export const useChartEditorStep = (spec: string | undefined): ChartEditorStepState => {
  const [step, setStep] = useState<ChartEditorStep>(() => resolveInitialStep(spec))
  const [aiReturnStep, setAiReturnStep] = useState<AiReturnStep>(STEP_EDITOR)

  return {
    step,
    stepNumber: guidedStepNumber(step, aiReturnStep),
    stepCount: GUIDED_STEP_COUNT,
    isRegenerating: step === STEP_AI && aiReturnStep === STEP_EDITOR,
    goToDataStep: () => setStep(STEP_DATA),
    goToMethodStep: () => setStep(STEP_METHOD),
    goToEditorStep: () => setStep(STEP_EDITOR),
    advanceFromDataStep: () =>
      setStep((current) => (current === STEP_DATA ? STEP_METHOD : current)),
    openAiPrompt: () => {
      // The prompt is reachable from the method step and from the editor; only the latter is
      // outside the guided flow.
      setAiReturnStep(step === STEP_EDITOR ? STEP_EDITOR : STEP_METHOD)
      setStep(STEP_AI)
    },
    closeAiPrompt: () => setStep(aiReturnStep),
  }
}
