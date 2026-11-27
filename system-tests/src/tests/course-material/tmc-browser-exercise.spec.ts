import { expect, type FrameLocator, type Page, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"

test.use({
  storageState: "src/states/student1@example.com.json",
  // Service workers need a secure context, which production's https gives. The full Chromium build
  // honours this flag; the headless shell does not.
  channel: "chromium",
  launchOptions: {
    args: ["--unsafely-treat-insecure-origin-as-secure=http://project-331.local"],
  },
})

// Seeded by seed_tmc_browser_exercise.rs.
const EXERCISE_PAGE =
  "http://project-331.local/org/uh-mathstat/courses/tmc-browser-exercise/chapter-1/hello-name"
const STUB = "# Write your solution here"
const SOLUTION = 'name = input("What is your name? ")\nprint("Hello " + name)\n'
// input() inside a function: blocks on the stdin service worker, not on an await.
const FUNCTION_INPUT = 'ask = lambda: input("Who? ")\nprint("Hi " + ask())\n'

function exerciseFrame(page: Page): FrameLocator {
  return page.frameLocator('iframe[title="Hello name"]')
}

/**
 * Replaces the editor's contents. Inserted as one edit so Monaco's auto-closing stays out of it;
 * Monaco still auto-indents, so `code` must not rely on indentation.
 */
async function replaceCode(page: Page, frame: FrameLocator, code: string) {
  await frame.locator(".monaco-editor .view-lines").click()
  await page.keyboard.press("ControlOrMeta+A")
  await page.keyboard.insertText(code)
}

/** Clicks Run and answers the program's one `input()` call. */
async function runWithInput(frame: FrameLocator, line: string) {
  await frame.getByRole("button", { name: "Run" }).click()
  const input = frame.getByRole("textbox", { name: "Program input" })
  await expect(input).toBeVisible({ timeout: 60_000 })
  await input.fill(line)
  await input.press("Enter")
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
    // Blocked first, so the unblock is the edit's upload and not the stub's.
    const submit = page.getByRole("button", { name: "Submit" })
    await expect(submit).toHaveAttribute("aria-disabled", "true")
    await expect(submit).toHaveAttribute("aria-disabled", "false")
    await page.reload()
    await expect(exerciseFrame(page).locator(".monaco-editor")).toContainText("Hello")
  })

  await test.step("Run reads input and prints", async () => {
    await runWithInput(frame, "Ada")
    await expect(frame.getByText("Hello Ada")).toBeVisible()
  })

  await test.step("Run reads input() inside a function", async () => {
    await replaceCode(page, frame, FUNCTION_INPUT)
    await runWithInput(frame, "Grace")
    await expect(frame.getByText("Hi Grace")).toBeVisible()
    await replaceCode(page, frame, SOLUTION)
  })

  await test.step("Test runs the exercise's tests in the browser", async () => {
    await frame.getByRole("button", { name: "Test" }).click()
    await expect(frame.getByText(/^Passed: /)).toBeVisible({ timeout: 30_000 })
    await expect(frame.getByText(/^Failed: /)).toHaveCount(0)
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
