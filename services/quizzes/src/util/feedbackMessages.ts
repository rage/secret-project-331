import type { QuizFeedbackMessage } from "../../types/quizTypes/privateSpec"

/**
 * The after-answer messages that apply at a given correctness. `on-model-solution` never applies
 * here (it flows through the model solution spec). Correctness keys off the score ratio: 1 correct,
 * 0 incorrect, strictly between is partially correct.
 */
export function applicableItemFeedbackMessages(
  messages: QuizFeedbackMessage[],
  correctnessCoefficient: number,
): string[] {
  return messages
    .filter((m) => {
      switch (m.visibility) {
        case "after-any-answer":
          return true
        case "after-correct-answer":
          return correctnessCoefficient === 1
        case "after-partially-correct-answer":
          return correctnessCoefficient > 0 && correctnessCoefficient < 1
        case "after-incorrect-answer":
          return correctnessCoefficient === 0
        case "on-model-solution":
          return false
        default:
          return false
      }
    })
    .map((m) => m.message)
}

/**
 * Trim, drop empties, join with a single space. Space (not "\n\n") because ParsedText renders inline
 * feedback via dangerouslySetInnerHTML with no white-space:pre, so a newline collapses to a space.
 */
export function joinFeedbackMessages(messages: string[]): string | null {
  const parts = messages.map((m) => m.trim()).filter((m) => m !== "")
  return parts.length > 0 ? parts.join(" ") : null
}

/**
 * Override rule: non-empty on-model-solution messages replace the graded (after-answer) feedback.
 * `gradedFeedback` is a versionless feedback_json string and passes through unchanged otherwise.
 */
export function resolveDisplayedFeedback(
  gradedFeedback: string | null | undefined,
  messagesOnModelSolution: string[] | null | undefined,
): string | null {
  const modelSolutionFeedback = joinFeedbackMessages(messagesOnModelSolution ?? [])
  if (modelSolutionFeedback !== null) {
    return modelSolutionFeedback
  }
  const trimmed = gradedFeedback?.trim()
  return trimmed && trimmed !== "" ? trimmed : null
}
