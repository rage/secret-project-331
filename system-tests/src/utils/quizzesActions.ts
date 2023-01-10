import { Locator, Page } from "@playwright/test"

export interface QuizItemOptionMultipleChoiceProps {
  type: "multiple-choice"
  correct: boolean
  title?: string
  messageAfterSubmissionWhenSelected?: string
  additionalCorrectnessExplanationOnModelSolution?: string
}

/**
 * Inputs values to opened quiz item option modal. The modal should already be opened before calling
 * this function, and it will be automatically closed in the end.
 */
export async function fillQuizItemOptionModal(
  page: Page,
  frame: Locator,
  props: QuizItemOptionMultipleChoiceProps,
) {
  switch (props.type) {
    // TODO: expand for other types of quiz items
    case "multiple-choice": {
      if (props.correct) {
        await frame.locator(`input[type="checkbox"]`).check()
      } else {
        await frame.locator(`input[type="checkbox"]`).uncheck()
      }
      if (props.title) {
        await frame.locator(`label:has-text("Option title") input`).fill(props.title)
      }
      if (props.messageAfterSubmissionWhenSelected) {
        await frame
          .locator(`label:has-text("Message after submission when selected") input`)
          .fill(props.messageAfterSubmissionWhenSelected)
      }
      if (props.additionalCorrectnessExplanationOnModelSolution) {
        await frame
          .locator(`label:has-text("Additional correctness explanation on model solution") input`)
          .fill(props.additionalCorrectnessExplanationOnModelSolution)
      }
    }
  }
  await closeModal(page, frame)
}

// TODO: Only call this from `fillQuizItemOptionModal` and don't export.
export async function closeModal(page: Page, frame: Locator) {
  await frame.locator(`[aria-label="Close"]`).waitFor()
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(100)
}
