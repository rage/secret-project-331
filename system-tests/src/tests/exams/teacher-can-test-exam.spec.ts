/* eslint-disable playwright/no-wait-for-timeout */
import { expect, test } from "@playwright/test"

import { getLocatorForNthExerciseServiceIframe, waitForViewType } from "@/utils/iframeLocators"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Testing exam works", async ({ page }) => {
  await test.step("Create exam", async () => {
    await page.goto("http://project-331.local/organizations")
    await page.getByLabel("University of Helsinki, Department of Computer Science").click()
    await page.getByRole("button", { name: "Create" }).nth(1).click()
    await page.getByLabel("Name", { exact: true }).fill("Exam for testing")
    await page.getByLabel("Starts at").fill("1990-12-03T12:00")
    await page.getByLabel("Ends at").fill("2052-03-09T09:08:01")
    await page.getByLabel("Time in minutes", { exact: true }).fill("60")
    await page.getByRole("button", { name: "Submit" }).click()
    await page.getByText("Exam created successfully").waitFor()
  })

  await test.step("Add exercise to exam", async () => {
    await page
      .getByTestId("exam-list-item")
      .filter({ hasText: "Exam for testing" })
      .getByRole("link", { name: "Manage" })
      .click()

    await page.getByRole("link", { name: "Manage page" }).click()
    await page.getByLabel("Toggle view").selectOption("block-menu")
    await page.getByRole("option", { name: "Exercise", exact: true }).click()
    await page.getByPlaceholder("Exercise name").fill("Exercise name")

    await page.getByLabel("Edit").click()
    await page.getByRole("button", { name: "Quizzes" }).click()
    const quizzesEditor = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)
    await quizzesEditor.getByRole("button", { name: "Multiple choice Choose" }).click()
    await quizzesEditor.getByLabel("Title", { exact: true }).fill("Multiple choice")
    await quizzesEditor.getByLabel("Option title", { exact: true }).fill("Correct answer")
    await quizzesEditor.getByLabel("Correct").check()
    await quizzesEditor.getByRole("button", { name: "Add option" }).click()
    await quizzesEditor.getByLabel("Option title", { exact: true }).fill("Wrong answer")
    await quizzesEditor.getByRole("button", { name: "Add option" }).click()
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await page.getByText("Success", { exact: true }).click()
  })

  await test.step("Navigate to exam", async () => {
    await page.goto("http://project-331.local/organizations")
    await page.getByLabel("University of Helsinki, Department of Computer Science").click()
    await page
      .getByTestId("exam-list-item")
      .filter({ hasText: "Exam for testing" })
      .getByRole("link", { name: "Manage" })
      .click()
  })

  await test.step("Take and submit exam", async () => {
    await page.getByRole("link", { name: "Test exam", exact: true }).click()
    page.on("dialog", (dialog) => dialog.accept())
    await page.locator(`button:text("Start the exam!")`).click()

    const quizzesIframe = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)
    await waitForViewType(quizzesIframe, "answer-exercise")
    await quizzesIframe.getByRole("button", { name: "Correct answer" }).click()
    await page.getByRole("button", { name: "Submit" }).click()
    await page.getByText("Your submission has been saved.").waitFor()
    await waitForViewType(quizzesIframe, "view-submission")
  })

  await test.step("Test showing and hiding answers", async () => {
    const quizzesIframe = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

    await page.getByLabel("show answers").check()
    await page.waitForTimeout(100)
    await waitForViewType(quizzesIframe, "view-submission")
    await expect(quizzesIframe.getByText("Your answer was correct.")).toBeVisible()
    await page.waitForTimeout(100)

    await page.getByLabel("show answers").uncheck()
    await page.waitForTimeout(100)
    await waitForViewType(quizzesIframe, "view-submission")
    await quizzesIframe
      .locator("div")
      .filter({ hasText: /^Correct answer$/ })
      .first()
      .waitFor()
    await expect(quizzesIframe.getByText("Your answer was correct.")).toBeHidden()
  })

  await test.step("Test resetting exam progress", async () => {
    const quizzesIframe = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

    // Small waits to make sure we're not proceeding too fast
    await page.waitForTimeout(100)
    await waitForViewType(quizzesIframe, "view-submission")
    await page.waitForTimeout(100)
    await waitForViewType(quizzesIframe, "view-submission")

    await page.getByRole("button", { name: "Reset exam progress" }).click()
    await page.getByText("Operation successful!").waitFor()
    await page.waitForTimeout(100)
    await waitForViewType(quizzesIframe, "answer-exercise")

    await quizzesIframe.getByRole("button", { name: "Correct answer" }).waitFor()
    await page.getByRole("button", { name: "Submit" }).isDisabled()

    await quizzesIframe.getByRole("button", { name: "Correct answer" }).click()
    await page.getByRole("button", { name: "Submit" }).click()
    await page.waitForTimeout(100)
    await waitForViewType(quizzesIframe, "view-submission")
    await page.waitForTimeout(100)
    await page.getByText("Your submission has been saved.").isVisible()
    await page.waitForTimeout(100)
    await page.getByText("Show answers").click()
    await page.waitForTimeout(100)
    await expect(quizzesIframe.getByText("Your answer was correct.")).toBeVisible()
  })
})
