// Plugin-contract test: drives the plugin's three views through the host emulator and asserts the
// messages it emits. This suite is inherited by every service scaffolded from this template —
// adapt the specs to your own data types. Run `pnpm run test:playwright:plugin-contract`.

import { expect, test } from "@playwright/test"

import { createHostEmulator } from "@/shared-module/exercise-service-test-utils/playwright/createHostEmulator"
import {
  answerExerciseState,
  exerciseEditorState,
  viewSubmissionState,
} from "@/shared-module/exercise-service-test-utils/protocol/stateBuilders"

import { withBrowserDiagnostics } from "../fixtures/diagnostics"

const contractTest = withBrowserDiagnostics(test)

const OPTIONS: [{ id: string; name: string }, { id: string; name: string }] = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Helsinki" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Tampere" },
]
const PRIVATE_SPEC = {
  version: "1",
  alternatives: [{ id: OPTIONS[0].id, name: "Helsinki", correct: true }],
}
const PUBLIC_SPEC = { version: "1", options: OPTIONS }
const GRADED_SUBMISSION = {
  public_spec: PUBLIC_SPEC,
  user_answer: { version: "1", selectedOptionId: OPTIONS[0].id },
  model_solution_spec: { version: "1", correctOptionIds: [OPTIONS[0].id] },
  grading: {
    grading_progress: "FullyGraded" as const,
    score_given: 1,
    score_maximum: 1,
    feedback_text: null,
    feedback_json: { version: "1", selectedOptionIsCorrect: true },
  },
}

contractTest.beforeEach(async ({ page }) => {
  // Open the plugin's iframe page first so it mounts and starts the handshake.
  await page.goto("/iframe")
})

contractTest("exercise-editor emits the private spec as current-state", async ({ page }) => {
  const host = await createHostEmulator(page)
  await host.setState(exerciseEditorState({ private_spec: PRIVATE_SPEC }))
  await host.waitForViewType("exercise-editor")

  const state = await host.waitForCurrentState((message) =>
    Array.isArray(
      (message.data as { private_spec?: { alternatives?: unknown } }).private_spec?.alternatives,
    ),
  )
  const privateSpec = (
    state.data as {
      private_spec: { version: string; alternatives: Record<string, unknown>[] }
    }
  ).private_spec
  expect(privateSpec.version).toBe("1")
  expect(privateSpec.alternatives[0]).toMatchObject({ name: "Helsinki", correct: true })
})

contractTest("answer-exercise reports the selected option as current-state", async ({ page }) => {
  const host = await createHostEmulator(page)
  await host.setState(answerExerciseState({ public_spec: PUBLIC_SPEC }))
  await host.waitForViewType("answer-exercise")

  await page.getByRole("checkbox", { name: "Tampere" }).click()

  const state = await host.waitForCurrentState(
    (message) => (message.data as { selectedOptionId?: string }).selectedOptionId === OPTIONS[1].id,
  )
  expect((state.data as { selectedOptionId: string }).selectedOptionId).toBe(OPTIONS[1].id)
})

contractTest("view-submission renders the graded submission", async ({ page }) => {
  const host = await createHostEmulator(page)
  await host.setState(viewSubmissionState(GRADED_SUBMISSION))
  await host.waitForViewType("view-submission")
  await expect(page.getByRole("checkbox", { name: "Helsinki" })).toBeVisible()
})

// Libraries hard-code CDN URLs in CSS and at runtime; a failed-request check only sees the ones that
// fail. Push every view so each one's assets load.
contractTest("loads nothing from outside this service", async ({ page, baseURL }) => {
  const ownOrigin = new URL(baseURL ?? "").origin
  const outside: string[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (url.origin !== ownOrigin && url.protocol !== "data:" && url.protocol !== "blob:") {
      outside.push(url.href)
    }
  })

  await page.reload()
  const host = await createHostEmulator(page)
  await host.setState(exerciseEditorState({ private_spec: PRIVATE_SPEC }))
  await host.waitForViewType("exercise-editor")
  await host.setState(answerExerciseState({ public_spec: PUBLIC_SPEC }))
  await host.waitForViewType("answer-exercise")
  await host.setState(viewSubmissionState(GRADED_SUBMISSION))
  await host.waitForViewType("view-submission")
  await page.waitForLoadState("networkidle")

  expect(outside).toEqual([])
})
