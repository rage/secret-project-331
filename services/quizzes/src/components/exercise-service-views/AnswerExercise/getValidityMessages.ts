import { wordCount } from "@/shared-module/common/utils/strings"
import { blankCellsInsideShape } from "@/util/matrix"

import type { UserAnswer } from "../../../../types/quizTypes/answer"
import type { PublicSpecQuizItem } from "../../../../types/quizTypes/publicSpec"

/** The translation keys this helper can emit. */
export type QuizValidityMessageKey =
  | "answer-all-parts-of-the-exercise"
  | "check-your-answer"
  | "matrix-fill-empty-cells"
  | "timeline-duplicate-answer-error"
  | "word-count-below-minimum"
  | "word-count-above-maximum"

/**
 * Localized reasons the current quiz answer is not yet submittable, sent to the parent with the
 * `current-state` message so it can tell the student why the submit button is greyed out
 * (course-improvements-issues#161). `t` is the i18next translator.
 */
export function getQuizValidityMessages(
  state: UserAnswer | null,
  itemCount: number,
  t: (key: QuizValidityMessageKey, options?: Record<string, number>) => string,
  items: PublicSpecQuizItem[] = [],
): string[] {
  const messages: string[] = []
  if ((state?.itemAnswers.length ?? 0) < itemCount) {
    messages.push(t("answer-all-parts-of-the-exercise"))
  }
  for (const item of state?.itemAnswers ?? []) {
    if (item.valid) {
      continue
    }
    const chosenEventIds =
      item.type === "timeline" ? item.timelineChoices.map((choice) => choice.chosenEventId) : []
    if (item.type === "timeline" && chosenEventIds.length !== new Set(chosenEventIds).size) {
      messages.push(t("timeline-duplicate-answer-error"))
    } else if (item.type === "essay") {
      const spec = items.find((i) => i.id === item.quizItemId)
      const words = wordCount(item.textData)
      if (spec?.type === "essay" && spec.minWords && words < spec.minWords) {
        messages.push(t("word-count-below-minimum", { count: words, min: spec.minWords }))
      } else if (spec?.type === "essay" && spec.maxWords && words > spec.maxWords) {
        messages.push(t("word-count-above-maximum", { count: words, max: spec.maxWords }))
      } else {
        messages.push(t("check-your-answer"))
      }
    } else if (item.type === "matrix" && blankCellsInsideShape(item.matrix).length > 0) {
      messages.push(t("matrix-fill-empty-cells"))
    } else {
      messages.push(t("check-your-answer"))
    }
  }
  // De-duplicate while preserving order so the same reason is not shown twice.
  return [...new Set(messages)]
}
