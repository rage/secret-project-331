import { test } from "@playwright/test"

import { scrollLocatorsParentIframeToViewIfNeeded } from "../utils/iframeLocators"

test("Playground views works", async ({ page }) => {
  await page.goto("http://project-331.local/playground-views")
  await page.getByRole("heading", { name: "Playground for exercise IFrames" }).waitFor()
  await page.getByText("Valid service info").waitFor()
  await scrollLocatorsParentIframeToViewIfNeeded(
    page.frameLocator('iframe[title="PLAYGROUND"]').getByRole("button", { name: "New" }),
  )
  await page.frameLocator('iframe[title="PLAYGROUND"]').getByRole("button", { name: "New" }).click()
  await page.frameLocator('iframe[title="PLAYGROUND"]').getByRole("button", { name: "New" }).click()
  await page
    .frameLocator('iframe[title="PLAYGROUND"]')
    .getByPlaceholder("Option text")
    .first()
    .click()
  await page
    .frameLocator('iframe[title="PLAYGROUND"]')
    .getByPlaceholder("Option text")
    .first()
    .fill("a")
  await page
    .frameLocator('iframe[title="PLAYGROUND"]')
    .getByPlaceholder("Option text")
    .nth(1)
    .click()
  await page
    .frameLocator('iframe[title="PLAYGROUND"]')
    .getByPlaceholder("Option text")
    .nth(1)
    .fill("b")
  await page.frameLocator('iframe[title="PLAYGROUND"]').getByRole("checkbox").first().check()
  await page
    .getByText(
      `{
  "private_spec": [
    {
      "name": "a",
      "correct": true,`,
    )
    .waitFor()
  await page.getByRole("button", { name: "Set as private spec input" }).click()
  await page
    .getByText(
      `"name": "b"
  }
]`,
    )
    .waitFor()
  await page
    .getByText(
      `{
  "correctOptionIds": [`,
    )
    .waitFor()
  await page.getByRole("button", { name: "answer-exercise" }).click()
  await page.getByText(`No current-state message received from the IFrame yet`).waitFor()
  await scrollLocatorsParentIframeToViewIfNeeded(
    page.frameLocator('iframe[title="PLAYGROUND"]').getByRole("checkbox", { name: "a" }),
  )
  await page.frameLocator('iframe[title="PLAYGROUND"]').getByRole("checkbox", { name: "a" }).click()
  await page.getByText('{ "selectedOptionId": ').waitFor()
  await page.getByRole("button", { name: "Submit" }).click()
  await page.getByText("Operation successful!").waitFor()
  await page.getByText('{ "selectedOptionId": ').first().waitFor()
  await page
    .getByText(
      `{
  "grading_progress": "FullyGraded",
  "score_given": 1,
  "score_maximum": 1,
  "feedback_text": "Good job!",
  "feedback_json": {
    "selectedOptionIsCorrect": true
  }
}`,
    )
    .waitFor()
  await page
    .getByLabel(
      "Send previous submission (happens when one has answered the exercise previously and tries to answer it again)",
    )
    .click()
  await page.getByRole("button", { name: "view-submission" }).click()
  await page.getByText(`No current-state message received from the IFrame yet`).waitFor()
  await scrollLocatorsParentIframeToViewIfNeeded(
    page.frameLocator('iframe[title="PLAYGROUND"]').getByRole("checkbox", { name: "b" }),
  )
  await page.frameLocator('iframe[title="PLAYGROUND"]').getByRole("checkbox", { name: "b" }).click()
})
