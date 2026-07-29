import type { UserAnswer } from "../../../../types/quizTypes/answer"

/** The translation keys this helper can emit. */
export type QuizValidityMessageKey =
  | "answer-all-parts-of-the-exercise"
  | "check-your-answer"
  | "timeline-duplicate-answer-error"

/**
 * Localized reasons the current quiz answer is not yet submittable, sent to the parent with the
 * `current-state` message so it can tell the student why the submit button is greyed out
 * (course-improvements-issues#161). `t` is the i18next translator.
 */
export function getQuizValidityMessages(
  state: UserAnswer | null,
  itemCount: number,
  t: (key: QuizValidityMessageKey) => string,
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
    } else {
      messages.push(t("check-your-answer"))
    }
  }
  // De-duplicate while preserving order so the same reason is not shown twice.
  return [...new Set(messages)]
}
