/**
 * @jest-environment jsdom
 */

"use client"

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { isEqual } from "lodash"
import { act, createElement, useRef, useState } from "react"
import { createRoot } from "react-dom/client"

import type { CmsPageUpdate } from "@/generated/api"
import type { BlockInstance } from "@/utils/Gutenberg/types"

import { denormalizeDocument } from "../../src/utils/documentSchemaProcessor"
import { modifyBlocks } from "../../src/utils/Gutenberg/modifyBlocks"

const EXERCISE_ID = "11111111-1111-4111-8111-111111111111"
const SLIDE_ID = "22222222-2222-4222-8222-222222222222"
const TASK_ID = "33333333-3333-4333-8333-333333333333"

/** Block names PageEditor treats as supported on a chapter page, as far as this fixture needs. */
const SUPPORTED_BLOCKS = [
  "core/paragraph",
  "moocfi/exercise",
  "moocfi/exercise-settings",
  "moocfi/exercise-slides",
  "moocfi/exercise-slide",
  "moocfi/exercise-task",
]

/** A saved chapter page holding one exercise, in the shape the CMS page endpoint returns. */
const savedExercisePage = (): CmsPageUpdate => ({
  content: [
    {
      name: "moocfi/exercise",
      isValid: true,
      clientId: "44444444-4444-4444-8444-444444444444",
      attributes: { id: EXERCISE_ID },
      innerBlocks: [],
    },
    // oxlint-disable-next-line typescript/no-explicit-any -- CmsPageUpdate types content as unknown
  ] as any,
  exercises: [
    {
      id: EXERCISE_ID,
      name: "Exercise",
      order_number: 0,
      score_maximum: 1,
      max_tries_per_slide: null,
      limit_number_of_tries: false,
      deadline: null,
      needs_peer_review: false,
      needs_self_review: false,
      peer_or_self_review_config: null,
      peer_or_self_review_questions: null,
      use_course_default_peer_or_self_review_config: false,
      teacher_reviews_answer_after_locking: true,
    },
  ],
  exercise_slides: [{ id: SLIDE_ID, exercise_id: EXERCISE_ID, order_number: 0 }],
  exercise_tasks: [
    {
      id: TASK_ID,
      exercise_slide_id: SLIDE_ID,
      exercise_type: "example-exercise",
      assignment: [
        {
          name: "core/paragraph",
          isValid: true,
          clientId: "55555555-5555-4555-8555-555555555555",
          attributes: { content: "Do the thing" },
          innerBlocks: [],
        },
        // oxlint-disable-next-line typescript/no-explicit-any -- CmsPageExerciseTask types assignment as unknown
      ] as any,
      private_spec: { a: 1 },
      order_number: 0,
    },
  ],
  title: "Example page",
  url_path: "/chapter-1/page-1",
  chapter_id: "66666666-6666-4666-8666-666666666666",
  hidden: false,
})

/**
 * Runs `work` with NODE_ENV set to `nodeEnv`.
 *
 * The browser bundle is not built with NODE_ENV=test, so anything that branches on it needs an
 * explicit override here to be tested at all.
 */
const withNodeEnv = async <T,>(nodeEnv: string, work: () => T | Promise<T>): Promise<T> => {
  const previous = process.env.NODE_ENV
  // oxlint-disable-next-line typescript/no-explicit-any -- NODE_ENV is typed as a readonly literal union
  ;(process.env as any).NODE_ENV = nodeEnv
  try {
    return await work()
  } finally {
    // oxlint-disable-next-line typescript/no-explicit-any -- NODE_ENV is typed as a readonly literal union
    ;(process.env as any).NODE_ENV = previous
  }
}

/** Mirrors how PageEditor decides whether the save and reset buttons are enabled. */
const contentSaved = (savedContent: BlockInstance[], content: BlockInstance[]): boolean =>
  isEqual(modifyBlocks(savedContent, SUPPORTED_BLOCKS), modifyBlocks(content, SUPPORTED_BLOCKS))

interface SaveStateProbeProps {
  onRender: (saved: boolean) => void
}

/**
 * Stands in for the page route plus PageEditor: fetches the page through the same
 * `useQuery` + inline `select` + `denormalizeDocument` chain, holds on to the blocks it was handed
 * when the page loaded the way the editor does, and reports whether the two still match.
 */
const SaveStateProbe = ({ onRender }: SaveStateProbeProps) => {
  const [, forceRender] = useState(0)
  const query = useQuery({
    queryKey: ["cms-page"],
    queryFn: () => Promise.resolve(savedExercisePage()),
    select: (data) => denormalizeDocument(data).content,
  })
  const editorContent = useRef<BlockInstance[] | null>(null)
  editorContent.current ??= query.data ?? null

  if (!editorContent.current || !query.data) {
    return null
  }

  onRender(contentSaved(query.data, editorContent.current))
  return createElement("button", { onClick: () => forceRender((tick) => tick + 1) })
}

beforeAll(() => {
  // oxlint-disable-next-line typescript/no-explicit-any -- React's act flag is not in the global types
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
})

it("keeps a loaded exercise page reported as saved across re-renders", async () => {
  const savedStates: boolean[] = []
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  await withNodeEnv("production", async () => {
    await act(() => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(SaveStateProbe, { onRender: (saved) => savedStates.push(saved) }),
        ),
      )
    })
    for (let click = 0; click < 3; click++) {
      await act(() => {
        container.querySelector("button")?.click()
      })
    }
  })

  await act(() => {
    root.unmount()
  })
  container.remove()
  queryClient.clear()

  expect(savedStates.length).toBeGreaterThan(1)
  expect(savedStates.every(Boolean)).toBe(true)
})

it("denormalizes a stored page to the same blocks in every environment", async () => {
  const page = savedExercisePage()
  const inTest = await withNodeEnv("test", () => denormalizeDocument(page).content)
  const inProduction = await withNodeEnv("production", () => denormalizeDocument(page).content)
  const inProductionAgain = await withNodeEnv("production", () => denormalizeDocument(page).content)

  expect(inProduction).toEqual(inTest)
  expect(inProductionAgain).toEqual(inProduction)
})
