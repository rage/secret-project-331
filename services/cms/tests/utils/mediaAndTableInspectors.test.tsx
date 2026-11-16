/**
 * @jest-environment jsdom
 */

"use client"

import { jest } from "@jest/globals"
import type { ComponentType } from "react"
import { act, createElement, Fragment } from "react"
import { createRoot } from "react-dom/client"

const editorState: { isPreviewMode?: boolean } = {}

await jest.unstable_mockModule("@wordpress/data", () => ({
  useSelect: (mapSelect: (select: () => unknown) => unknown) =>
    mapSelect(() => ({ getSettings: () => ({ isPreviewMode: editorState.isPreviewMode }) })),
}))
await jest.unstable_mockModule("@wordpress/element", () => ({ Fragment }))
await jest.unstable_mockModule("@wordpress/block-editor", () => ({
  InspectorControls: ({ children }: { children?: unknown }) =>
    createElement("aside", { "data-testid": "inspector" }, children as never),
}))
await jest.unstable_mockModule("@wordpress/components", () => ({
  Notice: ({ children }: { children?: unknown }) =>
    createElement("div", { className: "notice" }, children as never),
  PanelBody: ({ children }: { children?: unknown }) =>
    createElement("section", null, children as never),
  ToggleControl: ({
    label,
    checked,
    onChange,
  }: {
    label: string
    checked: boolean
    onChange: (value: boolean) => void
  }) =>
    createElement("input", {
      type: "checkbox",
      "aria-label": label,
      checked,
      onChange: (e: { target: { checked: boolean } }) => onChange(e.target.checked),
    }),
}))
await jest.unstable_mockModule("@wordpress/compose", () => ({
  createHigherOrderComponent:
    (mapComponent: (inner: ComponentType) => ComponentType) => (inner: ComponentType) =>
      mapComponent(inner),
}))
await jest.unstable_mockModule("@/utils/useCmsTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: {}, ready: true }),
}))

const [{ default: withMediaAutoplayWarning }, { default: withTableRowHeaders }] = await Promise.all(
  [
    import("@/utils/Gutenberg/withMediaAutoplayWarning"),
    import("@/utils/Gutenberg/withTableRowHeaders"),
  ],
)

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const BlockEditStub: ComponentType<Record<string, unknown>> = () =>
  createElement("div", { className: "block-edit" })

type BlockEditFilter = (blockEdit: ComponentType) => ComponentType<never>

const render = async (filter: BlockEditFilter, props: Record<string, unknown>) => {
  const Filtered = filter(BlockEditStub as ComponentType) as ComponentType<Record<string, unknown>>
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)
  await act(() => {
    root.render(createElement(Filtered, props))
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

beforeEach(() => {
  delete editorState.isPreviewMode
})

describe("withMediaAutoplayWarning", () => {
  it.each(["core/audio", "core/video"])(
    "warns in the %s inspector when autoplay is on",
    async (name) => {
      const { container, cleanup } = await render(withMediaAutoplayWarning, {
        name,
        attributes: { autoplay: true },
      })

      expect(container.querySelector("[data-testid=inspector]")?.textContent).toContain(
        "warning-media-autoplay",
      )
      expect(container.querySelector(".block-edit")).not.toBeNull()
      await cleanup()
    },
  )

  it("stays quiet when autoplay is off, in previews and for other blocks", async () => {
    const off = await render(withMediaAutoplayWarning, {
      name: "core/video",
      attributes: { autoplay: false },
    })
    expect(off.container.textContent).not.toContain("warning-")
    await off.cleanup()

    const other = await render(withMediaAutoplayWarning, {
      name: "core/paragraph",
      attributes: { autoplay: true },
    })
    expect(other.container.textContent).not.toContain("warning-")
    await other.cleanup()

    editorState.isPreviewMode = true
    const preview = await render(withMediaAutoplayWarning, {
      name: "core/audio",
      attributes: { autoplay: true },
    })
    expect(preview.container.textContent).not.toContain("warning-")
    await preview.cleanup()
  })
})

describe("withTableRowHeaders", () => {
  const body = [
    {
      cells: [
        { content: "A", tag: "td" },
        { content: "1", tag: "td" },
      ],
    },
  ]

  it("toggles the first column into row headers through setAttributes", async () => {
    const setAttributes = jest.fn()
    const { container, cleanup } = await render(withTableRowHeaders, {
      name: "core/table",
      attributes: { body },
      setAttributes,
    })

    const toggle = container.querySelector<HTMLInputElement>(
      "input[aria-label=first-column-row-headers]",
    )
    expect(toggle?.checked).toBe(false)
    await act(() => {
      toggle?.click()
    })

    expect(setAttributes).toHaveBeenCalledWith({
      body: [
        {
          cells: [
            { content: "A", tag: "th", scope: "row" },
            { content: "1", tag: "td" },
          ],
        },
      ],
    })
    await cleanup()
  })

  it("shows the toggle on for a table whose first column is already row headers", async () => {
    const { container, cleanup } = await render(withTableRowHeaders, {
      name: "core/table",
      attributes: { body: [{ cells: [{ content: "A", tag: "th", scope: "row" }] }] },
      setAttributes: jest.fn(),
    })

    expect(
      container.querySelector<HTMLInputElement>("input[aria-label=first-column-row-headers]")
        ?.checked,
    ).toBe(true)
    await cleanup()
  })

  it("does not run for other blocks", async () => {
    const { container, cleanup } = await render(withTableRowHeaders, {
      name: "core/paragraph",
      attributes: {},
      setAttributes: jest.fn(),
    })

    expect(container.querySelector("input")).toBeNull()
    await cleanup()
  })
})
