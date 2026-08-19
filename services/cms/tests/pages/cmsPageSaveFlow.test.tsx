/**
 * @jest-environment jsdom
 */

"use client"

import { jest } from "@jest/globals"
import type { UseMutationResult } from "@tanstack/react-query"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { isEqual } from "lodash"
import { act, createElement, useReducer } from "react"
import { createRoot } from "react-dom/client"

import type { CmsPageUpdate, ContentManagementPage, Page, UpdateCmsPageData } from "@/generated/api"

const PAGE_ID = "77777777-7777-4777-8777-777777777777"
const EXERCISE_ID = "11111111-1111-4111-8111-111111111111"
const SLIDE_ID = "22222222-2222-4222-8222-222222222222"
const TASK_ID = "33333333-3333-4333-8333-333333333333"
const EDITED_EXERCISE_NAME = "Renamed exercise"

/**
 * Block names PageEditor treats as supported on a chapter page, as far as this fixture needs. The
 * wrapper block is on the list in the real editor too, which is what makes modifyBlocks idempotent.
 */
const SUPPORTED_BLOCKS = [
  "core/paragraph",
  "moocfi/exercise",
  "moocfi/exercise-settings",
  "moocfi/exercise-slides",
  "moocfi/exercise-slide",
  "moocfi/exercise-task",
  "moocfi/unsupported-block-type",
]

const savedPage: Page = {
  id: PAGE_ID,
  title: "Example page",
  url_path: "/chapter-1/page-1",
  chapter_id: "66666666-6666-4666-8666-666666666666",
  course_id: "88888888-8888-4888-8888-888888888888",
  hidden: false,
  order_number: 0,
  created_at: "2020-01-01T00:00:00Z",
  updated_at: "2020-01-01T00:00:00Z",
  content: [
    {
      name: "moocfi/exercise",
      isValid: true,
      clientId: "44444444-4444-4444-8444-444444444444",
      attributes: { id: EXERCISE_ID },
      innerBlocks: [],
    },
    // Stored pages still hold blocks that are no longer registered; the editor wraps those on load
    // and unwraps them on save, so they are the case where the two sides can drift apart.
    {
      name: "moocfi/logo-link",
      isValid: true,
      clientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      attributes: { url: "https://example.com" },
      innerBlocks: [],
    },
  ],
}

/** What the CMS page endpoint returns for {@link savedPage}: one exercise, one slide, one task. */
const savedPageResponse = (): ContentManagementPage => ({
  page: savedPage,
  organization_id: "99999999-9999-4999-8999-999999999999",
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
      ],
      private_spec: { a: 1 },
      order_number: 0,
    },
  ],
  peer_or_self_review_configs: [],
  peer_or_self_review_questions: [],
})

/** Stands in for the backend: echoes the PUT body back in the endpoint's response shape. */
const savePageOnFakeBackend = (body: CmsPageUpdate): ContentManagementPage => ({
  ...savedPageResponse(),
  page: {
    ...savedPage,
    content: body.content,
    title: body.title,
    url_path: body.url_path,
    hidden: body.hidden,
    chapter_id: body.chapter_id ?? null,
  },
  exercises: body.exercises,
  exercise_slides: body.exercise_slides,
  exercise_tasks: body.exercise_tasks,
})

await jest.unstable_mockModule("next/router", () => ({
  useRouter: () => ({
    isReady: true,
    query: { id: PAGE_ID },
    asPath: `/pages/${PAGE_ID}`,
    push: () => Promise.resolve(true),
    replace: () => Promise.resolve(true),
    prefetch: () => Promise.resolve(undefined),
  }),
}))

await jest.unstable_mockModule("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
  usePathname: () => `/pages/${PAGE_ID}`,
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: PAGE_ID }),
}))

// The real PageEditor pulls in @wordpress/block-editor, which cannot load under jest: pnpm gives
// @wordpress/element its own react 18, whose `isValidElement` rejects the react 19 elements the
// inserter builds at module scope.
await jest.unstable_mockModule("../../src/components/editors/PageEditor", () => ({
  default: SaveStateProbe,
}))

const realSdk = await import("@/generated/api/sdk.generated")
await jest.unstable_mockModule("@/generated/api/sdk.generated", () => ({
  ...realSdk,
  updateCmsPage: ({ body }: { body: CmsPageUpdate } & UpdateCmsPageData) =>
    Promise.resolve(savePageOnFakeBackend(body)),
}))

const { getCmsPageQueryKey } = await import("@/generated/api/@tanstack/react-query.generated")
const { default: LoginStateContext } =
  await import("@/shared-module/common/contexts/LoginStateContext")
const { editorContentReducer } = await import("@/contexts/EditorContentContext")
const { denormalizeDocument, normalizeDocument } = await import("@/utils/documentSchemaProcessor")
const { modifyBlocks } = await import("@/utils/Gutenberg/modifyBlocks")
const { removeUnsupportedBlockType } = await import("@/utils/Gutenberg/removeUnsupportedBlockType")
const { isGutenbergBlockArray } = await import("@/utils/Gutenberg/gutenbergBlocks")
const { default: CmsPage } = await import("../../src/pages/pages/[id]")

type Blocks = Parameters<typeof modifyBlocks>[0]

interface SaveStateProbeProps {
  data: Page
  saveMutation: UseMutationResult<ContentManagementPage, unknown, CmsPageUpdate, unknown>
}

/** Returns `content` with the exercise renamed, standing in for a teacher editing the page. */
const withRenamedExercise = (content: Blocks): Blocks =>
  content.map((block) =>
    block.name === "moocfi/exercise"
      ? { ...block, attributes: { ...block.attributes, name: EDITED_EXERCISE_NAME } }
      : block,
  )

/**
 * Stands in for PageEditor: latches the blocks it was handed on load the way the editor's reducer
 * does, reports whether they still match the page it was given, and saves through the mutation the
 * page route built.
 */
function SaveStateProbe({ data, saveMutation }: SaveStateProbeProps) {
  const savedContent = modifyBlocks(data.content as Blocks, SUPPORTED_BLOCKS)
  const [content, contentDispatch] = useReducer(
    editorContentReducer,
    modifyBlocks(savedContent, SUPPORTED_BLOCKS),
  )

  const handleSave = () => {
    saveMutation.mutate(
      normalizeDocument({
        chapterId: data.chapter_id ?? null,
        content: removeUnsupportedBlockType(content),
        title: data.title,
        urlPath: data.url_path,
        hidden: data.hidden,
      }),
      {
        onSuccess: (saveResult) => {
          if (!isGutenbergBlockArray(saveResult.page.content)) {
            throw new Error("The saved page did not come back as blocks")
          }
          contentDispatch({
            type: "setContent",
            payload: modifyBlocks(
              denormalizeDocument({
                content: saveResult.page.content,
                exercises: saveResult.exercises,
                exercise_slides: saveResult.exercise_slides,
                exercise_tasks: saveResult.exercise_tasks,
                url_path: saveResult.page.url_path,
                title: saveResult.page.title,
                chapter_id: saveResult.page.chapter_id ?? null,
                hidden: saveResult.page.hidden,
              }).content,
              SUPPORTED_BLOCKS,
            ),
          })
        },
      },
    )
  }

  return createElement(
    "div",
    null,
    createElement(
      "span",
      { "data-testid": "save-state" },
      isEqual(savedContent, content) ? "saved" : "unsaved",
    ),
    createElement("button", {
      "data-testid": "edit",
      onClick: () => contentDispatch({ type: "setContent", payload: withRenamedExercise(content) }),
    }),
    createElement("button", { "data-testid": "save", onClick: handleSave }),
  )
}

const signedIn = { isLoading: false, signedIn: true, refresh: () => Promise.resolve(undefined) }

beforeAll(() => {
  // oxlint-disable-next-line typescript/no-explicit-any -- React's act flag is not in the global types
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
})

it("reports the page as saved again once a save has gone through", async () => {
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)
  // staleTime keeps the seeded entry from being refetched, so the only writes to it are the ones the
  // page route makes itself.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(getCmsPageQueryKey({ path: { page_id: PAGE_ID } }), savedPageResponse())

  const saveState = () => container.querySelector('[data-testid="save-state"]')?.textContent
  const click = async (testId: string) => {
    await act(() => {
      container.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)?.click()
    })
  }

  await act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          LoginStateContext.Provider,
          { value: signedIn },
          // `query` is inert: the route fills it from the router, but its HOC chain types it as required.
          createElement(CmsPage, { query: { id: PAGE_ID } }),
        ),
      ),
    )
  })
  await act(async () => {
    await Promise.resolve()
  })

  expect(saveState()).toBe("saved")

  await click("edit")
  expect(saveState()).toBe("unsaved")

  await click("save")
  await act(async () => {
    await Promise.resolve()
  })

  expect(saveState()).toBe("saved")
  expect(
    queryClient.getQueryData<ContentManagementPage>(
      getCmsPageQueryKey({ path: { page_id: PAGE_ID } }),
    )?.exercises[0]?.name,
  ).toBe(EDITED_EXERCISE_NAME)

  await act(() => {
    root.unmount()
  })
  container.remove()
  queryClient.clear()
})
