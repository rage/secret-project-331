import { Frame, Page } from "@playwright/test"

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
  frame: Frame,
  props: QuizItemOptionMultipleChoiceProps,
) {
  switch (props.type) {
    // TODO: expand for other types of quiz items
    case "multiple-choice": {
      if (props.correct) {
        await frame.check(`input[type="checkbox"]`)
      } else {
        await frame.uncheck(`input[type="checkbox"]`)
      }
      if (props.title) {
        await frame.fill(`label:has-text("Option title") input`, props.title)
      }
      if (props.messageAfterSubmissionWhenSelected) {
        await frame.fill(
          `label:has-text("Message after submission when selected") input`,
          props.messageAfterSubmissionWhenSelected,
        )
      }
      if (props.additionalCorrectnessExplanationOnModelSolution) {
        await frame.fill(
          `label:has-text("Additional correctness explanation on model solution") input`,
          props.additionalCorrectnessExplanationOnModelSolution,
        )
      }
    }
  }
  await closeModal(page, frame)
}

// TODO: Only call this from `fillQuizItemOptionModal` and don't export.
export async function closeModal(page: Page, frame: Frame) {
  // We shouldn't need any scrolling tricks as the modal is already in the viewport
  // const closeButtonLocator = frame.locator(`[aria-label="Close"]`)
  // const handle = await closeButtonLocator.elementHandle()
  // const boundingBox = await handle.boundingBox()
  // const y = boundingBox.y
  // await page.evaluate((y) => {
  //   window.scrollTo(0, y)
  // }, y)
  // const frameElement = await frame.frameElement()
  // frameElement.scrollIntoViewIfNeeded()
  await frame.click(`[aria-label="Close"]`)
  await frame.waitForTimeout(100)
}
