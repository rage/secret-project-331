import { expect, type FrameLocator, type Page, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"

test.use({
  storageState: "src/states/student1@example.com.json",
})

// Seeded by seed_tmc_browser_exercise.rs.
const EXERCISE_PAGE =
  "http://project-331.local/org/uh-mathstat/courses/tmc-browser-exercise/chapter-1/hello-name"
const STUB = "# Write your solution here"
const SOLUTION = 'name = input("What is your name? ")\nprint("Hello " + name)\n'

function exerciseFrame(page: Page): FrameLocator {
  return page.frameLocator('iframe[title="Hello name"]')
}

/** Replaces the editor's contents; inserted as one edit so Monaco's auto-closing stays out of it. */
async function replaceCode(page: Page, frame: FrameLocator, code: string) {
  await frame.locator(".monaco-editor .view-lines").click()
  await page.keyboard.press("ControlOrMeta+A")
  await page.keyboard.insertText(code)
}

test("a Python exercise is run, tested and submitted in the browser editor", async ({ page }) => {
  // Loads Pyodide, then waits for the grading pod.
  test.slow()
  await page.goto(EXERCISE_PAGE)
  await selectCourseInstanceIfPrompted(page)
  const frame = exerciseFrame(page)

  await test.step("the editor opens the student's file, not the project files", async () => {
    await expect(frame.locator(".monaco-editor")).toContainText(STUB, { timeout: 30_000 })
    await expect(frame.locator(".monaco-editor")).not.toContainText("tests_timeout_ms")
  })

  await test.step("a draft survives a reload", async () => {
    await replaceCode(page, frame, SOLUTION)
    // The draft is saved once the answer has been packed for submission.
    await expect(page.getByRole("button", { name: "Submit" })).toBeEnabled()
    await page.reload()
    await expect(exerciseFrame(page).locator(".monaco-editor")).toContainText("Hello")
  })

  await test.step("Run reads input and prints", async () => {
    await frame.getByRole("button", { name: "Run" }).click()
    const input = frame.getByRole("textbox", { name: "Program input" })
    await expect(input).toBeVisible({ timeout: 60_000 })
    await input.fill("Ada")
    await input.press("Enter")
    await expect(frame.getByText("Hello Ada")).toBeVisible()
  })

  await test.step("Test runs the exercise's tests in the browser", async () => {
    await frame.getByRole("button", { name: "Test" }).click()
    await expect(frame.getByText(/^Passed: /)).toBeVisible({ timeout: 30_000 })
  })

  await test.step("the graded result appears without a reload", async () => {
    await page.getByRole("button", { name: "Submit" }).click()
    await expect(frame.getByText("All tests passed! Score: 1/1.")).toBeVisible({
      timeout: 150_000,
    })
  })

  await test.step("the submission is shown after a reload", async () => {
    await page.reload()
    const reloaded = exerciseFrame(page)
    await expect(reloaded.getByText("All tests passed! Score: 1/1.")).toBeVisible()
    await expect(reloaded.locator(".monaco-editor")).toContainText("Hello")
    await expect(reloaded.locator(".monaco-editor")).not.toContainText("tests_timeout_ms")
  })
})
