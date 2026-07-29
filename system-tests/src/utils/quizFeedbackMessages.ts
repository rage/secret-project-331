import type { Locator } from "@playwright/test"

/**
 * The visible "When shown" labels of the quiz feedback-messages editor at item/quiz scope.
 *
 * The quiz editor used to expose fixed "Success message" / "Failure message" text fields. The
 * feedback redesign replaced them with a `FeedbackMessagesEditor`: a list of { visibility, message }
 * rows added via an "Add feedback message" button, each row pairing a "When shown" select with a
 * "Feedback message" text field. "After a correct answer" / "After an incorrect answer" are the
 * direct replacements for the old success / failure messages.
 */
export type QuizFeedbackVisibility =
  | "After any answer"
  | "After a correct answer"
  | "After a partially correct answer"
  | "After an incorrect answer"
  | "On the model solution"

/**
 * Adds one row to a quiz feedback-messages editor and fills it with the given visibility and text.
 *
 * `scope` must contain exactly one feedback-messages editor — pass a single quiz item's advanced
 * options container, not the whole iframe. A quiz page renders several editors (the quiz level plus
 * every item), so an unscoped locator would match multiple "Add feedback message" buttons and fail
 * strict-mode. The row just added is the last one, so its fields are targeted with `.last()`.
 */
export async function addQuizFeedbackMessage(
  scope: Locator,
  visibility: QuizFeedbackVisibility,
  message: string,
): Promise<void> {
  await scope.getByRole("button", { name: "Add feedback message" }).click()
  await scope.getByLabel("When shown", { exact: true }).last().selectOption({ label: visibility })
  await scope.getByLabel("Feedback message", { exact: true }).last().fill(message)
}
