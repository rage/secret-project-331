import type {
  PrivateSpecQuiz,
  PrivateSpecQuizItemClosedEndedQuestion,
} from "../../types/quizTypes/privateSpec"

/**
 * Whether a private spec is valid to save/derive/grade. This is the single place item invariants
 * live; the editor reports the result as the `valid` flag in `current-state` and the host uses it to
 * gate saving. Half-finished specs are still representable (parseable) — validity is a separate
 * judgement. Only closed-ended items have type-specific checks for now; other item types are treated
 * as valid until their invariants are encoded too. Feedback messages are checked at every scope.
 */

// Allowed visibility tags per scope. Checked at runtime (blobs are untrusted, not just typed).
const ITEM_FEEDBACK_VISIBILITIES: ReadonlySet<string> = new Set([
  "after-any-answer",
  "after-correct-answer",
  "after-partially-correct-answer",
  "after-incorrect-answer",
  "on-model-solution",
])

const OPTION_FEEDBACK_VISIBILITIES: ReadonlySet<string> = new Set([
  "when-selected-after-answer",
  "on-model-solution",
])

// Each entry must carry an allowed visibility and a non-blank message (an empty row is unsaveable,
// matching the null-gradingStrategy philosophy).
const areFeedbackMessagesValid = (
  messages: { visibility: string; message: string }[],
  allowedVisibilities: ReadonlySet<string>,
): boolean =>
  messages.every(
    (message) => allowedVisibilities.has(message.visibility) && message.message.trim() !== "",
  )

const isValidRegex = (pattern: string): boolean => {
  try {
    void new RegExp(pattern)
    return true
  } catch (_e) {
    return false
  }
}

const isClosedEndedItemValid = (item: PrivateSpecQuizItemClosedEndedQuestion): boolean => {
  if (item.formatRegex !== null && !isValidRegex(item.formatRegex)) {
    return false
  }
  const strategy = item.gradingStrategy
  if (strategy === null) {
    return false
  }
  switch (strategy.strategy) {
    case "exact-match": {
      const answers = strategy.acceptedAnswers.map((answer) => answer.trim()).filter(Boolean)
      if (answers.length === 0) {
        return false
      }
      const normalized = answers.map((answer) =>
        strategy.caseSensitive ? answer : answer.toLowerCase(),
      )
      return new Set(normalized).size === normalized.length
    }
    case "regex":
      return strategy.pattern.trim().length > 0 && isValidRegex(strategy.pattern)
    case "numeric":
      return (
        Number.isFinite(strategy.correctValue) &&
        Number.isFinite(strategy.tolerance) &&
        strategy.tolerance >= 0
      )
  }
}

export const validatePrivateSpec = (privateSpec: PrivateSpecQuiz | null): boolean => {
  if (!privateSpec) {
    return false
  }
  if (!areFeedbackMessagesValid(privateSpec.feedbackMessages, ITEM_FEEDBACK_VISIBILITIES)) {
    return false
  }
  return privateSpec.items.every((item) => {
    if (!areFeedbackMessagesValid(item.feedbackMessages, ITEM_FEEDBACK_VISIBILITIES)) {
      return false
    }
    if ("options" in item) {
      const optionsValid = item.options.every((option) =>
        areFeedbackMessagesValid(option.feedbackMessages, OPTION_FEEDBACK_VISIBILITIES),
      )
      if (!optionsValid) {
        return false
      }
    }
    if (item.type === "closed-ended-question") {
      return isClosedEndedItemValid(item)
    }
    return true
  })
}
