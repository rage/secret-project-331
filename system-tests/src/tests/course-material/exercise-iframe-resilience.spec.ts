import { expect, type Locator, type Page, test } from "@playwright/test"

import type {
  CurrentStateMessage,
  MessageFromIframe,
  MessageToIframe,
  SetStateMessage,
} from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"

import {
  getExerciseRegion,
  selectCourseInstanceIfPrompted,
} from "../../utils/courseMaterialActions"

const USER_STORAGE_STATE = "src/states/user@example.com.json"

test.use({
  storageState: USER_STORAGE_STATE,
})

const COURSE_URL = "http://project-331.local/org/uh-mathstat/courses/exercise-iframe-resilience"
const MULTI_TASK_PAGE = `${COURSE_URL}/chapter-1/multi-task-exercise`
const MANY_EXERCISES_PAGE = `${COURSE_URL}/chapter-1/many-exercises`
const MULTI_TASK_EXERCISE = "Multi-task exercise"
// Iframe titles; the host appends the task number from the second task on.
const [TASK_1, TASK_2, TASK_3] = [
  MULTI_TASK_EXERCISE,
  `${MULTI_TASK_EXERCISE} 2`,
  `${MULTI_TASK_EXERCISE} 3`,
] as const
const MANY_EXERCISE_NAMES = Array.from({ length: 16 }, (_, index) => `Exercise ${index + 1}`)

// Every task on the seeded pages is an example-exercise task; this replaces its iframe document.
const PLUGIN_IFRAME_URL = "**/example-exercise/iframe*"
const CHAPTER_LOCKS_URL = "**/api/v0/course-material/courses/*/user-chapter-locks"

// Mirror EXERCISE_IFRAME_LOAD_TIMING (exercise-iframe-host) and DEFAULT_LOAD_SLOT_CONFIG
// (common), which system-tests can't import.
const FAILURE_MS = 10_000
const LOAD_CAPACITY = 3
const LOAD_SLOT_MAX_HOLD_MS = 8_000

// Infinity would not survive serialization into the page.
const NEVER_READY_LOAD_COUNT = 1000
const NEVER_READY: FakePluginBehaviour = { brokenLoadCount: NEVER_READY_LOAD_COUNT }

const NOT_LOADED_MESSAGE = "This part of the exercise did not load."
const RELOAD_PART_BUTTON = "Reload this part"
const ANSWER_FIRST_MESSAGE = "Please complete your answer first."

/** How a simulated plugin behaves; read when its document loads unless noted. */
interface FakePluginBehaviour {
  /** This many first loads of the document never send `ready`, like a page whose script failed. */
  brokenLoadCount?: number
  /** Delay before the first `ready`, after the document loaded. */
  readyDelayMs?: number
  /** The first `ready` never reaches the host; the plugin's retry after 1 s does. */
  losesFirstReady?: boolean
  /**
   * Read on every `set-state`. `draft` (default) restores a host-sent `answer_draft`; `empty`
   * reports an empty, invalid answer on every `set-state`, ignoring the draft.
   */
  answerOnSetState?: "draft" | "empty"
}

interface FakePluginEvent {
  title: string
  loadNumber: number
  kind: "loaded" | "port-received" | "connected" | "message"
  message?: MessageToIframe
  /** The host page's clock, so faked and real time compare across frames. */
  at: number
}

/** Shared by the host page and its plugin iframes (same origin) as `window.fakePlugins`. */
interface FakePluginRegistry {
  behaviours: Record<string, FakePluginBehaviour>
  loadCounts: Record<string, number>
  events: FakePluginEvent[]
  /** When an iframe with this title first appeared, by the host page's clock. */
  iframeCreatedAt: Record<string, number>
  ports: Record<string, MessagePort>
  now: () => number
}

declare global {
  interface Window {
    fakePlugins?: FakePluginRegistry
  }
}

/** Runs in the host page before its scripts; frames get the same init script and skip it. */
function installFakePluginRegistry(behaviours: Record<string, FakePluginBehaviour>) {
  if (window !== window.top) {
    return
  }
  const registry: FakePluginRegistry = {
    behaviours,
    loadCounts: {},
    events: [],
    iframeCreatedAt: {},
    ports: {},
    now: () => Date.now(),
  }
  window.fakePlugins = registry
  new MutationObserver(() => {
    document
      .querySelectorAll<HTMLIFrameElement>('iframe[data-testid="message-channel-iframe"]')
      .forEach((iframe) => {
        registry.iframeCreatedAt[iframe.title] ??= Date.now()
      })
  }).observe(document, { childList: true, subtree: true })
}

/**
 * The plugin side of the protocol, serialized into the iframe document: `ready` (retried at 1, 3
 * and 7 s until a port arrives) → keeps the first port → answers `set-state` with `height-changed`.
 * Identifies itself by its iframe's title, which the same-origin sandbox lets it read.
 */
function runFakePlugin() {
  const registry = window.parent.fakePlugins
  const title = (window.frameElement as HTMLIFrameElement | null)?.title
  if (!registry || !title) {
    throw new Error("Fake plugin loaded outside a test page")
  }
  const loadNumber = (registry.loadCounts[title] ?? 0) + 1
  registry.loadCounts[title] = loadNumber
  const behaviour = registry.behaviours[title] ?? {}
  const record = (kind: FakePluginEvent["kind"], message?: MessageToIframe) => {
    registry.events.push({
      title,
      loadNumber,
      kind,
      ...(message && { message }),
      at: registry.now(),
    })
  }
  document.body.textContent = `${title}, load ${loadNumber}`
  record("loaded")
  if (loadNumber <= (behaviour.brokenLoadCount ?? 0)) {
    return
  }

  let port: MessagePort | null = null
  const postReady = () => {
    if (!port) {
      window.parent.postMessage("ready", "*")
    }
  }
  const readyDelayMs = behaviour.readyDelayMs ?? 0
  if (!behaviour.losesFirstReady) {
    setTimeout(postReady, readyDelayMs)
  }
  for (const retryDelayMs of [1000, 3000, 7000]) {
    setTimeout(postReady, readyDelayMs + retryDelayMs)
  }

  window.addEventListener("message", (event) => {
    if (event.data !== "communication-port" || port || !event.ports[0]) {
      return
    }
    const receivedPort = event.ports[0]
    port = receivedPort
    registry.ports[title] = receivedPort
    record("port-received")
    const send = (message: MessageFromIframe) => {
      // oxlint-disable-next-line unicorn/require-post-message-target-origin -- MessagePort.postMessage takes no targetOrigin
      receivedPort.postMessage(message)
    }
    let hasConnected = false
    receivedPort.addEventListener("message", ({ data }: MessageEvent<MessageToIframe>) => {
      record("message", data)
      if (data.message !== "set-state") {
        return
      }
      send({ message: "height-changed", data: 120 })
      if (!hasConnected) {
        hasConnected = true
        record("connected")
      }
      const answerOnSetState = registry.behaviours[title]?.answerOnSetState ?? "draft"
      if (answerOnSetState === "empty") {
        send({ message: "current-state", data: {}, valid: false })
      } else if (data.view_type === "answer-exercise" && data.answer_draft !== undefined) {
        send({ message: "current-state", data: data.answer_draft, valid: true })
      }
    })
    receivedPort.start()
  })
}

const FAKE_PLUGIN_DOCUMENT = `<!doctype html><html><body><script>(${runFakePlugin.toString()})()</script></body></html>`

async function openWithFakePlugins(
  page: Page,
  url: string,
  {
    behaviours = {},
    documentsHeldUntil,
  }: {
    behaviours?: Record<string, FakePluginBehaviour>
    /** Plugin documents are served only once this resolves, so their `load` event waits too. */
    documentsHeldUntil?: Promise<void>
  } = {},
) {
  await page.addInitScript(installFakePluginRegistry, behaviours)
  await page.route(PLUGIN_IFRAME_URL, async (route) => {
    await documentsHeldUntil
    await route.fulfill({ contentType: "text/html", body: FAKE_PLUGIN_DOCUMENT })
  })
  // The window's load event would also wait for held plugin documents.
  await page.goto(url, { waitUntil: "domcontentloaded" })
}

async function fakePluginEvents(page: Page, title?: string): Promise<FakePluginEvent[]> {
  const events = await page.evaluate(() => window.fakePlugins?.events ?? [])
  return title === undefined ? events : events.filter((event) => event.title === title)
}

async function setStatesReceived(page: Page, title: string): Promise<SetStateMessage[]> {
  return (await fakePluginEvents(page, title)).flatMap((event) =>
    event.message?.message === "set-state" ? [event.message] : [],
  )
}

async function setBehaviour(page: Page, title: string, behaviour: FakePluginBehaviour) {
  await page.evaluate(
    ([taskTitle, taskBehaviour]) => {
      if (window.fakePlugins) {
        window.fakePlugins.behaviours[taskTitle] = taskBehaviour
      }
    },
    [title, behaviour] as const,
  )
}

function loadCount(page: Page, title: string): Promise<number> {
  return page.evaluate((taskTitle) => window.fakePlugins?.loadCounts[taskTitle] ?? 0, title)
}

async function waitForConnection(page: Page, title: string, loadNumber = 1, timeout?: number) {
  await expect
    .poll(
      async () =>
        (await fakePluginEvents(page, title)).some(
          (event) => event.kind === "connected" && event.loadNumber === loadNumber,
        ),
      timeout === undefined ? {} : { timeout },
    )
    .toBe(true)
}

/** Reports an answer from the plugin of the task with this iframe title. */
async function answerTask(
  page: Page,
  title: string,
  answer?: Omit<CurrentStateMessage, "message">,
) {
  await waitForConnection(page, title)
  await page.evaluate(
    ([taskTitle, taskAnswer]) => {
      window.fakePlugins?.ports[taskTitle]?.postMessage({ message: "current-state", ...taskAnswer })
    },
    [title, answer ?? { data: { answer: title }, valid: true }] as const,
  )
}

/** Sends a plugin-initiated message, e.g. the reload request plugins send after a crash. */
async function sendFromPlugin(page: Page, title: string, message: { message: string }) {
  await page.evaluate(
    ([taskTitle, pluginMessage]) => {
      window.fakePlugins?.ports[taskTitle]?.postMessage(pluginMessage)
    },
    [title, message] as const,
  )
}

/**
 * Advances the host page's faked clock until `msSinceLoaded` has passed since the plugin document
 * with this title first loaded. Small steps let React render the state a timer set before later
 * timers run.
 */
async function advanceClockSinceLoaded(page: Page, title: string, msSinceLoaded: number) {
  const elapsedMs = await page.evaluate((taskTitle) => {
    const loaded = window.fakePlugins?.events.find(
      (event) => event.title === taskTitle && event.kind === "loaded",
    )
    if (!loaded || !window.fakePlugins) {
      throw new Error(`${taskTitle} has not loaded`)
    }
    return window.fakePlugins.now() - loaded.at
  }, title)
  await advanceClock(page, msSinceLoaded - elapsedMs)
}

async function advanceClock(page: Page, ms: number) {
  const stepMs = 250
  for (let advancedMs = 0; advancedMs < ms; advancedMs += stepMs) {
    await page.clock.runFor(Math.min(stepMs, ms - advancedMs))
  }
}

function taskContainer(page: Page, title: string): Locator {
  return page
    .getByTestId(/^throttled-renderer-exercise-iframe-/)
    .filter({ has: page.locator(`iframe[title="${title}"]`) })
}

function submitButton(page: Page, exerciseName = MULTI_TASK_EXERCISE): Locator {
  return getExerciseRegion(page, exerciseName).getByRole("button", { name: "Submit" })
}

async function expectSubmittable(page: Page) {
  await expect(submitButton(page)).toHaveAttribute("aria-disabled", "false")
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: USER_STORAGE_STATE })
  await page.goto(MULTI_TASK_PAGE)
  await selectCourseInstanceIfPrompted(page)
  await page.close()
})

test("healthy plugins connect and enable submit once every task is answered", async ({ page }) => {
  await openWithFakePlugins(page, MULTI_TASK_PAGE)

  for (const title of [TASK_1, TASK_2, TASK_3]) {
    await waitForConnection(page, title)
  }
  await expect(submitButton(page)).toHaveAttribute("aria-disabled", "true")
  await expect(getExerciseRegion(page, MULTI_TASK_EXERCISE)).toContainText(ANSWER_FIRST_MESSAGE)

  for (const title of [TASK_1, TASK_2, TASK_3]) {
    await answerTask(page, title)
  }

  await expectSubmittable(page)
  for (const title of [TASK_1, TASK_2, TASK_3]) {
    const setStates = await setStatesReceived(page, title)
    expect(setStates.map((state) => state.view_type)).toStrictEqual(["answer-exercise"])
  }
  await expect(page.getByText(NOT_LOADED_MESSAGE)).toHaveCount(0)
})

test("a task that never sends ready shows a reload button at 10 s that reloads only that task", async ({
  page,
}) => {
  await page.clock.install()
  await openWithFakePlugins(page, MULTI_TASK_PAGE, {
    behaviours: { [TASK_2]: NEVER_READY },
  })
  await answerTask(page, TASK_1)
  await answerTask(page, TASK_3)
  await page.evaluate(() => {
    document.documentElement.dataset.sameDocument = "true"
  })

  await advanceClockSinceLoaded(page, TASK_2, FAILURE_MS - 1500)
  await expect(taskContainer(page, TASK_2).getByText(NOT_LOADED_MESSAGE)).toBeHidden()
  // The document loaded without `ready`, so the host reloaded it once on its own.
  await expect.poll(() => loadCount(page, TASK_2)).toBe(2)

  await advanceClock(page, 2000)
  await expect(taskContainer(page, TASK_2).getByText(NOT_LOADED_MESSAGE)).toBeVisible()
  await expect(submitButton(page)).toHaveAttribute("aria-disabled", "true")
  await expect(getExerciseRegion(page, MULTI_TASK_EXERCISE)).toContainText(
    "A part of the exercise did not load.",
  )

  await setBehaviour(page, TASK_2, {})
  const loadsBeforeReload = await loadCount(page, TASK_2)
  await taskContainer(page, TASK_2).getByRole("button", { name: RELOAD_PART_BUTTON }).click()
  await waitForConnection(page, TASK_2, loadsBeforeReload + 1)
  await expect(taskContainer(page, TASK_2).getByText(NOT_LOADED_MESSAGE)).toBeHidden()
  await answerTask(page, TASK_2)

  await expectSubmittable(page)
  await expect(page.locator("html")).toHaveAttribute("data-same-document", "true")
  for (const title of [TASK_1, TASK_3]) {
    expect(await setStatesReceived(page, title)).toHaveLength(1)
  }
})

test("a document whose script fails once is reloaded automatically", async ({ page }) => {
  await page.clock.install()
  await openWithFakePlugins(page, MULTI_TASK_PAGE, {
    behaviours: { [TASK_1]: { brokenLoadCount: 1 } },
  })
  await waitForConnection(page, TASK_2)

  await advanceClockSinceLoaded(page, TASK_1, 5000)
  await waitForConnection(page, TASK_1, 2)
  await advanceClockSinceLoaded(page, TASK_1, FAILURE_MS + 2000)

  await expect(page.getByText(NOT_LOADED_MESSAGE)).toHaveCount(0)
  await expect(page.getByRole("button", { name: RELOAD_PART_BUTTON })).toHaveCount(0)
})

test("a slow document is not interrupted", async ({ page }) => {
  await page.clock.install()
  const { promise: documentsHeldUntil, resolve: releaseDocuments } = Promise.withResolvers<void>()
  await openWithFakePlugins(page, MULTI_TASK_PAGE, { documentsHeldUntil })
  await expect(page.locator(`iframe[title="${TASK_1}"]`)).toBeAttached()

  await advanceClock(page, 7000)
  releaseDocuments()
  for (const title of [TASK_1, TASK_2, TASK_3]) {
    await waitForConnection(page, title)
  }
  await advanceClock(page, 5000)

  await expect(page.getByText(NOT_LOADED_MESSAGE)).toHaveCount(0)
  for (const title of [TASK_1, TASK_2, TASK_3]) {
    expect(await loadCount(page, title)).toBe(1)
  }
})

test("a lost first ready is recovered by the plugin's retry", async ({ page }) => {
  await openWithFakePlugins(page, MULTI_TASK_PAGE, {
    behaviours: { [TASK_3]: { losesFirstReady: true } },
  })

  await waitForConnection(page, TASK_3)
  await answerTask(page, TASK_1)
  await answerTask(page, TASK_2)
  await answerTask(page, TASK_3)

  await expectSubmittable(page)
  expect(await loadCount(page, TASK_3)).toBe(1)
})

test("answers survive the chapter locks arriving after them", async ({ page }) => {
  const heldLocks: (() => Promise<void>)[] = []
  await page.route(CHAPTER_LOCKS_URL, (route) => {
    heldLocks.push(() => route.continue())
  })
  await openWithFakePlugins(page, MULTI_TASK_PAGE)
  for (const title of [TASK_1, TASK_2, TASK_3]) {
    await answerTask(page, title)
  }
  await expectSubmittable(page)
  await expect.poll(() => heldLocks.length).toBeGreaterThan(0)

  const locksResponse = page.waitForResponse(CHAPTER_LOCKS_URL)
  await Promise.all(heldLocks.map((release) => release()))
  await locksResponse

  await expectSubmittable(page)
})

test("an empty answer sent on every set-state survives refetches but not a reload", async ({
  page,
}) => {
  const heldLocks: (() => Promise<void>)[] = []
  await page.route(CHAPTER_LOCKS_URL, (route) => {
    heldLocks.push(() => route.continue())
  })
  await openWithFakePlugins(page, MULTI_TASK_PAGE, {
    behaviours: { [TASK_2]: { answerOnSetState: "empty" } },
  })
  for (const title of [TASK_1, TASK_2, TASK_3]) {
    await answerTask(page, title)
  }
  await expectSubmittable(page)

  // The locks re-run the state update, but a state equal to the posted one is not re-sent.
  await expect.poll(() => heldLocks.length).toBeGreaterThan(0)
  const locksResponse = page.waitForResponse(CHAPTER_LOCKS_URL)
  await Promise.all(heldLocks.map((release) => release()))
  await locksResponse
  await expectSubmittable(page)
  expect(await setStatesReceived(page, TASK_2)).toHaveLength(1)

  // A reload re-sends the state with the answer as a draft; the host keeps whatever the plugin
  // reports after that, even an empty answer.
  await sendFromPlugin(page, TASK_2, { message: "request-iframe-reload" })
  await waitForConnection(page, TASK_2, 2)
  const setStates = await setStatesReceived(page, TASK_2)
  expect(setStates).toHaveLength(2)
  expect(setStates[1]).toMatchObject({ answer_draft: { answer: TASK_2 } })
  await expect(submitButton(page)).toHaveAttribute("aria-disabled", "true")
  await expect(getExerciseRegion(page, MULTI_TASK_EXERCISE)).toContainText(ANSWER_FIRST_MESSAGE)
})

test("a reloaded task gets its last answer back as a draft", async ({ page }) => {
  await page.clock.install()
  await openWithFakePlugins(page, MULTI_TASK_PAGE)
  for (const title of [TASK_1, TASK_3]) {
    await answerTask(page, title)
  }
  await answerTask(page, TASK_2, { data: { choice: "first" }, valid: false })
  await answerTask(page, TASK_2, { data: { choice: "second" }, valid: true })
  await expectSubmittable(page)

  // The plugin crashes and its reloads never come up again, until the student reloads the task.
  await setBehaviour(page, TASK_2, NEVER_READY)
  await sendFromPlugin(page, TASK_2, { message: "request-iframe-reload" })
  await expect.poll(() => loadCount(page, TASK_2)).toBe(2)
  await advanceClock(page, FAILURE_MS + 1000)
  const reloadButton = taskContainer(page, TASK_2).getByRole("button", { name: RELOAD_PART_BUTTON })
  await expect(reloadButton).toBeVisible()

  await setBehaviour(page, TASK_2, {})
  const loadsBeforeReload = await loadCount(page, TASK_2)
  await reloadButton.click()
  await waitForConnection(page, TASK_2, loadsBeforeReload + 1)

  const setStates = await setStatesReceived(page, TASK_2)
  expect(setStates.at(-1)).toMatchObject({
    view_type: "answer-exercise",
    answer_draft: { choice: "second" },
  })
  await expectSubmittable(page)
})

test("a blocked submit focuses the first failing task", async ({ page }) => {
  await page.clock.install()
  await openWithFakePlugins(page, MULTI_TASK_PAGE, {
    behaviours: { [TASK_3]: NEVER_READY },
  })
  await answerTask(page, TASK_1)
  await answerTask(page, TASK_2, {
    data: {},
    valid: false,
    validityMessages: ["Answer question 2."],
  })
  await advanceClockSinceLoaded(page, TASK_3, FAILURE_MS + 1000)
  await expect(taskContainer(page, TASK_3).getByText(NOT_LOADED_MESSAGE)).toBeVisible()

  await submitButton(page).click()

  await expect(page.locator(`iframe[title="${TASK_2}"]`)).toBeFocused()
  await expect(page.locator(`iframe[title="${TASK_2}"]`)).toBeInViewport()
  await expect
    .poll(async () =>
      (await fakePluginEvents(page, TASK_2)).some(
        (event) => event.message?.message === "focus-first-invalid",
      ),
    )
    .toBe(true)
  await expect(getExerciseRegion(page, MULTI_TASK_EXERCISE)).toContainText("Answer question 2.")

  await answerTask(page, TASK_2)
  await submitButton(page).click()

  await expect(
    taskContainer(page, TASK_3).getByRole("button", { name: RELOAD_PART_BUTTON }),
  ).toBeFocused()
})

test("many iframes load a few at a time and each connects or shows an error", async ({ page }) => {
  test.slow()
  const random = seededRandom(331)
  const neverReady = ["Exercise 5", "Exercise 12"]
  const brokenLoadCounts: Record<string, number> = {
    "Exercise 3": 1,
    "Exercise 9": 1,
    "Exercise 14": 1,
    ...Object.fromEntries(neverReady.map((title) => [title, NEVER_READY_LOAD_COUNT])),
  }
  const behaviours = Object.fromEntries(
    MANY_EXERCISE_NAMES.map((title) => [
      title,
      {
        brokenLoadCount: brokenLoadCounts[title] ?? 0,
        readyDelayMs: Math.floor(random() * 2500),
      },
    ]),
  )
  await openWithFakePlugins(page, MANY_EXERCISES_PAGE, { behaviours })

  for (const title of MANY_EXERCISE_NAMES.filter((name) => !neverReady.includes(name))) {
    await waitForConnection(page, title, (brokenLoadCounts[title] ?? 0) + 1, 40_000)
    await expect(taskContainer(page, title).getByText(NOT_LOADED_MESSAGE)).toBeHidden()
  }
  for (const title of neverReady) {
    await expect(taskContainer(page, title).getByText(NOT_LOADED_MESSAGE)).toBeVisible({
      timeout: 40_000,
    })
  }

  const events = await fakePluginEvents(page)
  const iframeCreatedAt = await page.evaluate(() => window.fakePlugins?.iframeCreatedAt ?? {})
  const loadingIntervals = MANY_EXERCISE_NAMES.map((title) => {
    const createdAt = iframeCreatedAt[title]
    if (createdAt === undefined) {
      throw new Error(`${title} never rendered an iframe`)
    }
    const connectedAt = events.find(
      (event) => event.title === title && event.kind === "connected",
    )?.at
    // A slot is held until the task connects or for at most the hold time; the margin covers the
    // gap between granting a slot and the iframe appearing.
    const holdEndsAt = createdAt + LOAD_SLOT_MAX_HOLD_MS - 500
    return { start: createdAt, end: Math.min(connectedAt ?? holdEndsAt, holdEndsAt) }
  })
  expect(maxOverlap(loadingIntervals)).toBeLessThanOrEqual(LOAD_CAPACITY + 1)
})

test("iframes in view load before those further down the page", async ({ page }) => {
  // Held documents keep the first slots busy until the student has scrolled to the end.
  const { promise: documentsHeldUntil, resolve: releaseDocuments } = Promise.withResolvers<void>()
  await openWithFakePlugins(page, MANY_EXERCISES_PAGE, { documentsHeldUntil })
  await expect(page.getByTestId(/^throttled-renderer-exercise-iframe-/)).toHaveCount(
    MANY_EXERCISE_NAMES.length,
  )

  await getExerciseRegion(page, "Exercise 16").scrollIntoViewIfNeeded()
  releaseDocuments()

  await waitForConnection(page, "Exercise 8", 1, 30_000)
  const iframeCreatedAt = await page.evaluate(() => window.fakePlugins?.iframeCreatedAt ?? {})
  expect(iframeCreatedAt["Exercise 16"]).toBeLessThan(iframeCreatedAt["Exercise 8"] ?? 0)
})

/** Deterministic PRNG (mulberry32) so the scenario is the same on every run. */
function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function maxOverlap(intervals: { start: number; end: number }[]): number {
  const boundaries = intervals
    .flatMap(({ start, end }) => [
      { at: start, change: 1 },
      { at: end, change: -1 },
    ])
    // Ends before starts at the same instant: a slot handed straight on is not an overlap.
    .toSorted((a, b) => a.at - b.at || a.change - b.change)
  let current = 0
  let max = 0
  for (const { change } of boundaries) {
    current += change
    max = Math.max(max, current)
  }
  return max
}
