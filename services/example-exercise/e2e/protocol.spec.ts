// End-to-end protocol test: drives the plugin's three views through the host emulator and asserts
// the messages it emits. This suite is inherited by every service scaffolded from this template —
// adapt the specs to your own data types. Run it with `pnpm exec playwright test` (see
// playwright.config.ts for the chromium note). It is not part of `pnpm test` (vitest) or CI.

import { expect, test } from "@playwright/test"

import { createHostEmulator } from "@/shared-module/exercise-service-test-utils/playwright/createHostEmulator"
import {
  answerExerciseState,
  exerciseEditorState,
  viewSubmissionState,
} from "@/shared-module/exercise-service-test-utils/protocol/stateBuilders"

const OPTIONS = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Helsinki" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Tampere" },
]

test.beforeEach(async ({ page }) => {
  // Open the plugin's iframe page first so it mounts and starts the handshake.
  await page.goto("/iframe")
})

test("exercise-editor emits the private spec as current-state", async ({ page }) => {
  const host = await createHostEmulator(page)
  await host.setState(
    exerciseEditorState({
      private_spec: [{ id: OPTIONS[0].id, name: "Helsinki", correct: true }],
    }),
  )
  await host.waitForViewType("exercise-editor")

  const state = await host.waitForCurrentState((message) =>
    Array.isArray((message.data as { private_spec?: unknown }).private_spec),
  )
  const privateSpec = (state.data as { private_spec: Array<{ name: string; correct: boolean }> })
    .private_spec
  expect(privateSpec[0]).toMatchObject({ name: "Helsinki", correct: true })
})

test("answer-exercise reports the selected option as current-state", async ({ page }) => {
  const host = await createHostEmulator(page)
  await host.setState(answerExerciseState({ public_spec: OPTIONS }))
  await host.waitForViewType("answer-exercise")

  await page.getByRole("checkbox", { name: "Tampere" }).click()

  const state = await host.waitForCurrentState(
    (message) => (message.data as { selectedOptionId?: string }).selectedOptionId === OPTIONS[1].id,
  )
  expect((state.data as { selectedOptionId: string }).selectedOptionId).toBe(OPTIONS[1].id)
})

test("view-submission renders the graded submission", async ({ page }) => {
  const host = await createHostEmulator(page)
  await host.setState(
    viewSubmissionState({
      public_spec: OPTIONS,
      user_answer: { selectedOptionId: OPTIONS[0].id },
      model_solution_spec: { correctOptionIds: [OPTIONS[0].id] },
      grading: {
        grading_progress: "FullyGraded",
        score_given: 1,
        score_maximum: 1,
        feedback_text: null,
        feedback_json: { selectedOptionIsCorrect: true },
      },
    }),
  )
  await host.waitForViewType("view-submission")
  await expect(page.getByRole("checkbox", { name: "Helsinki" })).toBeVisible()
})
