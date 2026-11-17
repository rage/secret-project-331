/**
 * @jest-environment jsdom
 */

"use client"

import { jest } from "@jest/globals"
import type { ComponentType } from "react"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"

const dispatch = jest.fn()

await jest.unstable_mockModule("@wordpress/block-editor", () => ({
  useBlockProps: (props: Record<string, unknown> = {}) => props,
}))
await jest.unstable_mockModule("@/utils/Gutenberg/RegisteredInnerBlocks", () => ({
  default: () => null,
}))
await jest.unstable_mockModule("@/hooks/useAllExerciseServices", () => ({
  default: () => ({
    data: [],
    isFetching: false,
    isError: false,
    error: undefined,
    refetch: () => {},
  }),
}))
await jest.unstable_mockModule("@/utils/useCmsTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: {}, ready: true }),
}))

const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query")
const { EditorContentDispatch } = await import("@/contexts/EditorContentContext")
const { default: ExerciseTaskEditor } =
  await import("@/blocks/Exercise/ExerciseTask/ExerciseTaskEditor")
const { default: ExerciseSlideEditor } =
  await import("@/blocks/Exercise/ExerciseSlide/ExerciseSlideEditor")

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mount = async (element: ReturnType<typeof createElement>) => {
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)
  await act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        createElement(EditorContentDispatch.Provider, { value: dispatch }, element),
      ),
    )
  })
  return {
    container,
    cleanup: async () => {
      await act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

const taskProps = (showEditor: boolean) => ({
  attributes: {
    id: "task-1",
    exercise_type: "",
    private_spec: null,
    private_spec_files: [],
    show_editor: showEditor,
    order_number: 0,
  },
  clientId: "task-client",
  setAttributes: jest.fn(),
})

const Task = ExerciseTaskEditor as unknown as ComponentType<ReturnType<typeof taskProps>>
const Slide = ExerciseSlideEditor as unknown as ComponentType<Record<string, unknown>>

beforeEach(() => {
  dispatch.mockClear()
})

describe("ExerciseTaskEditor controls", () => {
  it("renders native buttons with constant names and aria-expanded", async () => {
    const closed = await mount(createElement(Task, taskProps(false)))
    const edit = closed.container.querySelector("button[aria-label=edit-task]")
    expect(edit?.tagName).toBe("BUTTON")
    expect(edit?.getAttribute("aria-expanded")).toBe("false")
    expect(closed.container.querySelector("button[aria-label=delete-task]")).not.toBeNull()
    expect(closed.container.querySelector("[role=button]")).toBeNull()
    await closed.cleanup()

    const open = await mount(createElement(Task, taskProps(true)))
    const openEdit = open.container.querySelector("button[aria-label=edit-task]")
    expect(openEdit?.getAttribute("aria-expanded")).toBe("true")
    await open.cleanup()
  })

  it("deletes through the native button", async () => {
    const { container, cleanup } = await mount(createElement(Task, taskProps(false)))
    await act(() => {
      container.querySelector<HTMLButtonElement>("button[aria-label=delete-task]")?.click()
    })

    expect(dispatch).toHaveBeenCalledWith({
      type: "deleteExerciseTask",
      payload: { clientId: "task-client" },
    })
    await cleanup()
  })
})

const pressTab = (target: Element, shiftKey = false) => {
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true }))
}

describe("ExerciseTaskEditor Tab containment", () => {
  it("keeps Tab and Shift+Tab from bubbling out of the block, except from fields", async () => {
    const { container, cleanup } = await mount(createElement(Task, taskProps(false)))
    const outer = jest.fn()
    document.body.addEventListener("keydown", outer)
    const edit = container.querySelector("button[aria-label=edit-task]") as Element
    pressTab(edit)
    pressTab(edit, true)
    expect(outer).not.toHaveBeenCalled()

    const input = document.createElement("input")
    edit.parentElement?.append(input)
    pressTab(input)
    expect(outer).toHaveBeenCalledTimes(1)

    edit.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }))
    expect(outer).toHaveBeenCalledTimes(2)
    document.body.removeEventListener("keydown", outer)
    await cleanup()
  })
})

describe("ExerciseSlideEditor Add task", () => {
  it("moves focus to the new task's Edit button once it renders", async () => {
    const { container, cleanup } = await mount(
      createElement(Slide, { attributes: { id: "slide-1", order_number: 0 }, clientId: "slide" }),
    )
    const addButton = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("add-task"),
    )
    await act(() => {
      addButton?.click()
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: "addExerciseTask",
      payload: { clientId: "slide" },
    })

    const newEdit = document.createElement("button")
    newEdit.setAttribute("data-exercise-task-edit", "")
    await act(async () => {
      container.querySelector("#slide-1")?.append(newEdit)
      await Promise.resolve()
    })

    expect(document.activeElement).toBe(newEdit)
    await cleanup()
  })
})
