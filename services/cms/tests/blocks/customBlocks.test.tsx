/**
 * @jest-environment jsdom
 */

"use client"

import { jest } from "@jest/globals"
import type { ComponentType, ReactNode } from "react"
import { act, createElement, useCallback, useRef, useState } from "react"
import { createRoot } from "react-dom/client"

import type { ExerciseAttributes } from "@/blocks/Exercise"
import { setupIntersectionObserverMock } from "@/shared-module/common/test-utils/mockIntersectionObserver"
import type { BlockConfiguration } from "@/utils/Gutenberg/types"

const CLIENT_ID = "test-client-id"
const BLOCK_ID = `block-${CLIENT_ID}`
const BLOCK_LIST_CLASS = "block-editor-block-list__block"

/** Elements the mocked `useBlockProps` ref was attached to during the current render. */
const refTargets: Element[] = []

const stub = (tag: string) => {
  const Stub = ({ children }: { children?: unknown }) => createElement(tag, null, children as never)
  Stub.displayName = `Stub(${tag})`
  return Stub
}

/**
 * Returns the same shape as the real `useBlockProps`, so the assertions below can tell a spread from a
 * cherry-pick: a block that drops the ref, the id, the class list or the aria wiring fails them.
 */
await jest.unstable_mockModule("@wordpress/block-editor", () => ({
  useBlockProps: (props: Record<string, unknown> = {}) => ({
    ...props,
    ref: (element: Element | null) => {
      if (element) {
        refTargets.push(element)
      }
    },
    id: BLOCK_ID,
    role: "document",
    tabIndex: 0,
    "data-block": CLIENT_ID,
    className: [BLOCK_LIST_CLASS, "wp-block", props.className].filter(Boolean).join(" "),
  }),
  BlockControls: stub("div"),
  BlockEditorKeyboardShortcuts: stub("div"),
  BlockEditorProvider: stub("div"),
  BlockIcon: stub("div"),
  BlockInspector: stub("div"),
  BlockList: stub("div"),
  BlockTools: stub("div"),
  ButtonBlockAppender: stub("div"),
  InnerBlocks: stub("div"),
  InspectorControls: stub("div"),
  MediaPlaceholder: stub("div"),
  ObserveTyping: stub("div"),
  RichText: stub("div"),
  WritingFlow: stub("div"),
  __experimentalLibrary: stub("div"),
  __experimentalListView: stub("div"),
  __unstableEditorStyles: {},
  __unstableUseBlockSelectionClearer: () => undefined,
}))

await jest.unstable_mockModule("@wordpress/components", () => ({
  Button: stub("button"),
  ColorPalette: stub("div"),
  Dropdown: stub("div"),
  MenuGroup: stub("div"),
  MenuItem: stub("div"),
  Notice: stub("div"),
  PanelBody: stub("div"),
  Path: stub("path"),
  Placeholder: stub("div"),
  Popover: stub("div"),
  SVG: stub("svg"),
  SelectControl: stub("div"),
  SlotFillProvider: stub("div"),
  TextControl: stub("div"),
  ToolbarButton: stub("button"),
  ToolbarDropdownMenu: stub("div"),
  ToolbarGroup: stub("div"),
}))

// Unlike the other blocks' queries (all gated on a courseId from context, which stays unset here),
// moocfi/exercise-custom-view-block fetches unconditionally. jsdom has no Fetch API globals, so the
// real request throws synchronously; how many renders land before the assertions run then depends on
// a microtask-timing race, intermittently doubling the wrapper ref push this file asserts against.
await jest.unstable_mockModule("@/hooks/useAllExerciseServices", () => ({
  default: () => ({
    data: [],
    isFetching: false,
    isError: false,
    error: undefined,
    refetch: () => {},
  }),
}))

const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query")
const {
  blockTypeMapForPages,
  blockTypeMapForFrontPages,
  blockTypeMapForTopLevelPages,
  blockTypeMapForResearchConsentForm,
} = await import("@/blocks/index")
const { default: BlockWrapper } = await import("@/blocks/BlockWrapper")
const { default: BlockPlaceholderWrapper } = await import("@/blocks/BlockPlaceholderWrapper")
const { default: ExerciseBlockContext } = await import("@/contexts/ExerciseBlockContext")

const registeredBlocks = new Map<string, BlockConfiguration>()
for (const [name, configuration] of [
  ...blockTypeMapForPages,
  ...blockTypeMapForFrontPages,
  ...blockTypeMapForTopLevelPages,
  ...blockTypeMapForResearchConsentForm,
]) {
  registeredBlocks.set(name, configuration)
}

const blockNames = [...registeredBlocks.keys()].toSorted()

/** Renders past this many attribute updates and the block is looping, not settling. */
const ATTRIBUTE_UPDATE_LIMIT = 50

/**
 * Stands in for the editor: holds the attributes in state so that edit components which give
 * themselves an id through `setAttributes` reach their real rendering path. Like Gutenberg's store it
 * ignores updates that change no value — blocks that call `setAttributes` straight from their render
 * body (moocfi/chatbot) would otherwise re-render forever.
 */
const EditHost = ({
  Edit,
  initialAttributes,
}: {
  Edit: ComponentType<Record<string, unknown>>
  initialAttributes: Record<string, unknown>
}) => {
  const [attributes, setAttributes] = useState(initialAttributes)
  const updateCount = useRef(0)
  const updateAttributes = useCallback(
    (update: Record<string, unknown> | ((previous: Record<string, unknown>) => unknown)) => {
      updateCount.current += 1
      if (updateCount.current > ATTRIBUTE_UPDATE_LIMIT) {
        throw new Error("Block edit never stopped updating its own attributes")
      }
      setAttributes((previous) => {
        const next = (typeof update === "function" ? update(previous) : update) as Record<
          string,
          unknown
        >
        if (Object.entries(next).every(([key, value]) => previous[key] === value)) {
          return previous
        }
        return { ...previous, ...next }
      })
    },
    [],
  )

  return createElement(Edit, {
    attributes,
    setAttributes: updateAttributes,
    clientId: CLIENT_ID,
    isSelected: false,
  })
}

/** Renders into the document and returns a detached copy of the resulting markup. */
const renderInEditor = async (element: ReactNode): Promise<HTMLElement> => {
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  refTargets.length = 0
  await act(() => {
    root.render(createElement(QueryClientProvider, { client: queryClient }, element))
  })
  const markup = document.createElement("div")
  markup.innerHTML = container.innerHTML
  await act(() => {
    root.unmount()
  })
  container.remove()
  queryClient.clear()
  return markup
}

const EXERCISE_ATTRIBUTES: ExerciseAttributes = {
  id: "05d75d5a-9b1c-4f4e-8b1c-2b3a4c5d6e7f",
  name: "Exercise",
  score_maximum: 1,
  limit_number_of_tries: false,
  needs_peer_review: false,
  needs_self_review: false,
  peer_or_self_review_config: "null",
  peer_or_self_review_questions_config: "[]",
  use_course_default_peer_review: false,
}

/**
 * Puts a block inside the contexts its edit component needs to reach the branch a real editor
 * renders. A block whose context is missing falls back to an empty wrapper, which satisfies the
 * assertions below while leaving the branch that matters untested.
 */
const withBlockContext = (name: string, element: ReactNode): ReactNode => {
  if (name === "moocfi/exercise-settings") {
    return createElement(
      ExerciseBlockContext.Provider,
      { value: { attributes: EXERCISE_ATTRIBUTES, setAttributes: () => undefined } },
      element,
    )
  }
  return element
}

const renderBlockEdit = (name: string): Promise<HTMLElement> => {
  const configuration = registeredBlocks.get(name)
  if (!configuration?.edit) {
    throw new Error(`Block ${name} has no edit component`)
  }
  const initialAttributes = Object.fromEntries(
    Object.entries(configuration.attributes).map(([key, value]) => [key, value.default]),
  )
  const Edit = configuration.edit as unknown as ComponentType<Record<string, unknown>>
  return renderInEditor(
    withBlockContext(name, createElement(EditHost, { Edit, initialAttributes })),
  )
}

beforeAll(() => {
  setupIntersectionObserverMock()
})

describe("custom block registrations", () => {
  it("covers every custom block the editors register", () => {
    expect(registeredBlocks.size).toBeGreaterThan(40)
  })

  it.each(blockNames)("%s declares apiVersion 3", (name) => {
    expect(registeredBlocks.get(name)?.apiVersion).toBe(3)
  })

  it.each(blockNames)("%s has an edit component", (name) => {
    expect(typeof registeredBlocks.get(name)?.edit).toBe("function")
  })
})

describe("custom block edit components", () => {
  it.each(blockNames)(
    "%s applies the block wrapper props to its outermost element",
    async (name) => {
      const markup = await renderBlockEdit(name)

      const wrappers = markup.querySelectorAll(`[data-block="${CLIENT_ID}"]`)
      // Two would mean the doubled wrapper that apiVersion 3 removes is back.
      expect(wrappers).toHaveLength(1)
      expect(markup.children).toHaveLength(1)

      const wrapper = markup.firstElementChild
      expect(wrapper).toBe(wrappers[0])
      expect(wrapper?.getAttribute("id")).toBe(BLOCK_ID)
      expect(wrapper?.getAttribute("role")).toBe("document")
      expect(wrapper?.getAttribute("tabindex")).toBe("0")
      expect(wrapper?.classList.contains(BLOCK_LIST_CLASS)).toBe(true)
    },
  )

  it.each(blockNames)("%s passes the block wrapper ref through", async (name) => {
    await renderBlockEdit(name)

    expect(refTargets).toHaveLength(1)
    expect(refTargets[0]?.getAttribute("data-block")).toBe(CLIENT_ID)
  })
})

describe("shared block wrappers", () => {
  it("BlockWrapper marks its own element as the block", async () => {
    const markup = await renderInEditor(
      createElement(BlockWrapper, {}, createElement("p", null, "content")),
    )

    const wrapper = markup.firstElementChild
    expect(wrapper?.tagName).toBe("DIV")
    // Nothing of its own on top of the block wrapper props, so the block keeps Gutenberg's own id.
    expect(wrapper?.getAttributeNames().toSorted()).toEqual([
      "class",
      "data-block",
      "id",
      "role",
      "tabindex",
    ])
    expect(wrapper?.innerHTML).toBe("<p>content</p>")
  })

  it("BlockPlaceholderWrapper keeps a caller's class next to the block classes", async () => {
    const markup = await renderInEditor(
      createElement(BlockPlaceholderWrapper, {
        title: "title",
        explanation: "explanation",
        className: "caller-class",
      }),
    )

    const wrapper = markup.firstElementChild
    expect(wrapper?.classList.contains("caller-class")).toBe(true)
    expect(wrapper?.classList.contains(BLOCK_LIST_CLASS)).toBe(true)
    expect(wrapper?.getAttribute("id")).toBe(BLOCK_ID)
  })
})
