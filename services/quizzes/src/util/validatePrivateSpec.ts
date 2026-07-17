import type {
  PrivateSpecQuiz,
  PrivateSpecQuizItemClosedEndedQuestion,
} from "../../types/quizTypes/privateSpec"

/**
 * Whether a private spec is valid to save/derive/grade. This is the single place item invariants
 * live; the editor reports the result as the `valid` flag in `current-state` and the host uses it to
 * gate saving. Half-finished specs are still representable (parseable) — validity is a separate
 * judgement. Only closed-ended items are checked here for now; other item types are treated as valid
 * (matching the previous always-true behavior) until their invariants are encoded too.
 */

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
  return privateSpec.items.every((item) =>
    item.type === "closed-ended-question" ? isClosedEndedItemValid(item) : true,
  )
}
