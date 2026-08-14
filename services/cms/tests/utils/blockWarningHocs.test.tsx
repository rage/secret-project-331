/**
 * @jest-environment jsdom
 */

"use client"

import { jest } from "@jest/globals"
import type { ComponentType } from "react"
import { act, createElement, Fragment, useEffect, useMemo, useState } from "react"
import { createRoot } from "react-dom/client"

import type { BlockInstance } from "@/utils/Gutenberg/types"

interface EditorState {
  isPreviewMode?: boolean
  blocks?: BlockInstance[]
}

const editorState: EditorState = {}
const useSelectSpy = jest.fn()
/** Whole-document read the heading warnings must not make: it re-renders every block per keystroke. */
const getBlocksSpy = jest.fn(() => editorState.blocks ?? [])
/** Stands in for "the html warning analysis ran": both html heuristics start by parsing the block. */
const parseFromStringSpy = jest.spyOn(DOMParser.prototype, "parseFromString")

const createBlock = (
  clientId: string,
  name: string,
  attributes: Record<string, unknown> = {},
  innerBlocks: BlockInstance[] = [],
): BlockInstance =>
  ({
    clientId,
    name,
    isValid: true,
    attributes,
    innerBlocks,
  }) as BlockInstance

const flattenBlocks = (blocks: BlockInstance[]): BlockInstance[] =>
  blocks.flatMap((block) => [block, ...flattenBlocks(block.innerBlocks)])

const blockEditorStore = {
  getSettings: () => ({ isPreviewMode: editorState.isPreviewMode }),
  getBlocks: getBlocksSpy,
  getBlocksByName: (blockNames: string[]) =>
    flattenBlocks(editorState.blocks ?? [])
      .filter((block) => blockNames.includes(block.name))
      .map((block) => block.clientId),
  getBlock: (clientId: string) =>
    flattenBlocks(editorState.blocks ?? []).find((block) => block.clientId === clientId) ?? null,
}

await jest.unstable_mockModule("@wordpress/data", () => ({
  useSelect: (mapSelect: (select: () => unknown) => unknown) => {
    useSelectSpy()
    return mapSelect(() => blockEditorStore)
  },
}))
await jest.unstable_mockModule("@wordpress/element", () => ({
  Fragment,
  useEffect,
  useMemo,
  useState,
}))
await jest.unstable_mockModule("@wordpress/components", () => ({
  Notice: ({ children }: { children?: unknown }) =>
    createElement("div", { className: "notice" }, children as never),
}))
await jest.unstable_mockModule("@wordpress/compose", () => ({
  createHigherOrderComponent:
    (mapComponent: (inner: ComponentType) => ComponentType) => (inner: ComponentType) =>
      mapComponent(inner),
}))
await jest.unstable_mockModule("@/utils/useCmsTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: {}, ready: true }),
}))

const [
  { default: withHeadingHierarchyWarnings },
  { default: withParagraphWarnings },
  { default: withCustomHtmlParagraphWarning },
  { default: withImageWarnings },
  { default: withImageFocalPointReset },
] = await Promise.all([
  import("@/utils/Gutenberg/withHeadingHierarchyWarnings"),
  import("@/utils/Gutenberg/withParagraphWarnings"),
  import("@/utils/Gutenberg/withCustomHtmlParagraphWarning"),
  import("@/utils/Gutenberg/withImageWarnings"),
  import("@/utils/Gutenberg/withImageFocalPointReset"),
])

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const UNTOUCHED_BLOCK_MARKUP = `<div class="block-edit"></div>`

const BlockEditStub: ComponentType<Record<string, unknown>> = () =>
  createElement("div", { className: "block-edit" })

type BlockEditFilter = (blockEdit: ComponentType) => ComponentType<never>

/** Renders the filtered block edit once per props object, and returns the markup of the last render. */
const renderFiltered = async (
  filter: BlockEditFilter,
  ...propsSequence: Record<string, unknown>[]
): Promise<string> => {
  const Filtered = filter(BlockEditStub as ComponentType) as ComponentType<Record<string, unknown>>
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)
  for (const props of propsSequence) {
    await act(() => {
      root.render(createElement(Filtered, props))
    })
  }
  const markup = container.innerHTML
  await act(() => {
    root.unmount()
  })
  container.remove()
  return markup
}

beforeEach(() => {
  delete editorState.isPreviewMode
  delete editorState.blocks
  useSelectSpy.mockClear()
  getBlocksSpy.mockClear()
  parseFromStringSpy.mockClear()
})

describe("withHeadingHierarchyWarnings", () => {
  const heroThenH3 = [
    createBlock("hero", "moocfi/hero-section", { title: "Page title" }),
    createBlock("h3", "core/heading", { level: 3, content: "Skipped h2" }),
  ]

  it("warns on the heading that jumps a level", async () => {
    editorState.blocks = heroThenH3

    const markup = await renderFiltered(withHeadingHierarchyWarnings, {
      name: "core/heading",
      clientId: "h3",
      attributes: { level: 3, content: "Skipped h2" },
    })

    expect(markup).toContain("warning-heading-level-jump")
    expect(markup).toContain("warning-heading-guidance-gap")
    expect(getBlocksSpy).not.toHaveBeenCalled()
  })

  it("warns when a core heading takes the h1 reserved for the hero section", async () => {
    editorState.blocks = [createBlock("h1", "core/heading", { level: 1, content: "Title" })]

    const markup = await renderFiltered(withHeadingHierarchyWarnings, {
      name: "core/heading",
      clientId: "h1",
      attributes: { level: 1, content: "Title" },
    })

    expect(markup).toContain("warning-heading-h1-reserved")
  })

  it("warns when the first authored heading starts deeper than h2", async () => {
    editorState.blocks = [createBlock("h3", "core/heading", { level: 3, content: "Deep start" })]

    const markup = await renderFiltered(withHeadingHierarchyWarnings, {
      name: "core/heading",
      clientId: "h3",
      attributes: { level: 3, content: "Deep start" },
    })

    expect(markup).toContain("warning-heading-first-should-be-h2")
  })

  it("leaves the well-ordered headings of the same document alone", async () => {
    editorState.blocks = [
      createBlock("hero", "moocfi/hero-section", { title: "Page title" }),
      createBlock("h2", "core/heading", { level: 2, content: "Overview" }),
    ]

    const markup = await renderFiltered(withHeadingHierarchyWarnings, {
      name: "core/heading",
      clientId: "h2",
      attributes: { level: 2, content: "Overview" },
    })

    expect(markup).not.toContain("warning-heading")
  })

  it("takes the fixed level of a custom block heading into account", async () => {
    editorState.blocks = [
      createBlock("term", "moocfi/terminology", { title: "Key concept" }),
      createBlock("aside", "moocfi/aside-with-image", { title: "Side note" }),
    ]

    const markup = await renderFiltered(withHeadingHierarchyWarnings, {
      name: "moocfi/aside-with-image",
      clientId: "aside",
      attributes: { title: "Side note" },
    })

    expect(markup).toContain("warning-heading-level-jump")
  })

  it("finds headings nested inside other blocks", async () => {
    editorState.blocks = [
      createBlock("hero", "moocfi/hero-section", { title: "Page title" }),
      createBlock("objective", "moocfi/course-objective-section", { title: "Goals" }, [
        createBlock("inner-h5", "core/heading", { level: 5, content: "Objective A" }),
      ]),
    ]

    const markup = await renderFiltered(withHeadingHierarchyWarnings, {
      name: "core/heading",
      clientId: "inner-h5",
      attributes: { level: 5, content: "Objective A" },
    })

    expect(markup).toContain("warning-heading-level-jump")
  })

  it("does not read the editor store for blocks that cannot be headings", async () => {
    editorState.blocks = heroThenH3

    const markup = await renderFiltered(withHeadingHierarchyWarnings, {
      name: "core/paragraph",
      clientId: "paragraph",
      attributes: { content: "Body text" },
    })

    expect(markup).toBe(UNTOUCHED_BLOCK_MARKUP)
    expect(useSelectSpy).not.toHaveBeenCalled()
    expect(getBlocksSpy).not.toHaveBeenCalled()
  })

  it("stays quiet in block previews", async () => {
    editorState.blocks = heroThenH3
    editorState.isPreviewMode = true

    const markup = await renderFiltered(withHeadingHierarchyWarnings, {
      name: "core/heading",
      clientId: "h3",
      attributes: { level: 3, content: "Skipped h2" },
    })

    expect(markup).not.toContain("warning-heading")
  })
})

describe("withParagraphWarnings", () => {
  const boldParagraphProps = {
    name: "core/paragraph",
    attributes: { content: "<strong>Looks like a heading</strong>" },
  }

  it("warns about a fully bolded short paragraph", async () => {
    await expect(renderFiltered(withParagraphWarnings, boldParagraphProps)).resolves.toContain(
      "warning-paragraph-bold-line-looks-like-heading",
    )
    expect(parseFromStringSpy).toHaveBeenCalled()
  })

  it("leaves a normal paragraph alone", async () => {
    await expect(
      renderFiltered(withParagraphWarnings, {
        name: "core/paragraph",
        attributes: { content: "A sentence with some <strong>emphasis</strong> in it." },
      }),
    ).resolves.not.toContain("warning-")
  })

  it("reuses the analysis when an unrelated prop changes", async () => {
    await renderFiltered(
      withParagraphWarnings,
      { ...boldParagraphProps, isSelected: false },
      { ...boldParagraphProps, isSelected: true },
    )

    expect(parseFromStringSpy).toHaveBeenCalledTimes(1)
  })

  it("does not analyze the html of other blocks", async () => {
    const markup = await renderFiltered(withParagraphWarnings, {
      name: "core/heading",
      attributes: { content: "<strong>Looks like a heading</strong>" },
    })

    expect(markup).toBe(UNTOUCHED_BLOCK_MARKUP)
    expect(parseFromStringSpy).not.toHaveBeenCalled()
    expect(useSelectSpy).not.toHaveBeenCalled()
  })

  it("stays quiet in block previews", async () => {
    editorState.isPreviewMode = true

    await expect(renderFiltered(withParagraphWarnings, boldParagraphProps)).resolves.not.toContain(
      "warning-",
    )
    expect(parseFromStringSpy).not.toHaveBeenCalled()
  })
})

describe("withCustomHtmlParagraphWarning", () => {
  const unwrappedHtmlProps = {
    name: "core/html",
    attributes: { content: "Bare text without a paragraph wrapper" },
  }

  it("warns about custom html that is missing a paragraph wrapper", async () => {
    await expect(
      renderFiltered(withCustomHtmlParagraphWarning, unwrappedHtmlProps),
    ).resolves.toContain("warning-custom-html-missing-paragraph-wrapper")
    expect(parseFromStringSpy).toHaveBeenCalled()
  })

  it("leaves already wrapped custom html alone", async () => {
    await expect(
      renderFiltered(withCustomHtmlParagraphWarning, {
        name: "core/html",
        attributes: { content: "<p>Wrapped text</p>" },
      }),
    ).resolves.not.toContain("warning-")
  })

  it("reuses the analysis when an unrelated prop changes", async () => {
    await renderFiltered(
      withCustomHtmlParagraphWarning,
      { ...unwrappedHtmlProps, isSelected: false },
      { ...unwrappedHtmlProps, isSelected: true },
    )

    expect(parseFromStringSpy).toHaveBeenCalledTimes(1)
  })

  it("does not analyze the html of other blocks", async () => {
    const markup = await renderFiltered(withCustomHtmlParagraphWarning, {
      name: "core/paragraph",
      attributes: { content: "Bare text without a paragraph wrapper" },
    })

    expect(markup).toBe(UNTOUCHED_BLOCK_MARKUP)
    expect(parseFromStringSpy).not.toHaveBeenCalled()
    expect(useSelectSpy).not.toHaveBeenCalled()
  })

  it("stays quiet in block previews", async () => {
    editorState.isPreviewMode = true

    await expect(
      renderFiltered(withCustomHtmlParagraphWarning, unwrappedHtmlProps),
    ).resolves.not.toContain("warning-")
    expect(parseFromStringSpy).not.toHaveBeenCalled()
  })
})

describe("withImageWarnings", () => {
  const missingAltProps = { name: "core/image", attributes: { alt: "" } }

  it("warns about a missing alt text", async () => {
    await expect(renderFiltered(withImageWarnings, missingAltProps)).resolves.toContain(
      "warning-image-alt-placeholder",
    )
  })

  it("leaves a described image alone", async () => {
    await expect(
      renderFiltered(withImageWarnings, {
        name: "core/image",
        attributes: { alt: "A cat asleep on a keyboard" },
      }),
    ).resolves.not.toContain("warning-")
  })

  it("does not run for other blocks", async () => {
    const markup = await renderFiltered(withImageWarnings, {
      name: "core/paragraph",
      attributes: { alt: "" },
    })

    expect(markup).toBe(UNTOUCHED_BLOCK_MARKUP)
    expect(useSelectSpy).not.toHaveBeenCalled()
  })

  it("stays quiet in block previews", async () => {
    editorState.isPreviewMode = true

    await expect(renderFiltered(withImageWarnings, missingAltProps)).resolves.not.toContain(
      "warning-",
    )
  })
})

describe("withImageFocalPointReset", () => {
  const renderImage = async (attributes: Record<string, unknown>, name = "core/image") => {
    const setAttributes = jest.fn()
    await renderFiltered(withImageFocalPointReset, { name, attributes, setAttributes })
    return setAttributes
  }

  it("clears a scale that no longer crops anything", async () => {
    const setAttributes = await renderImage({
      url: "https://example.com/image.png",
      width: "auto",
      height: "200px",
      scale: "cover",
      focalPoint: { x: 0.25, y: 0.75 },
    })

    expect(setAttributes).toHaveBeenCalledWith({ scale: undefined, focalPoint: undefined })
  })

  it("leaves an image without a scale untouched", async () => {
    const setAttributes = await renderImage({
      url: "https://example.com/image.png",
      width: "auto",
      height: "200px",
    })

    expect(setAttributes).not.toHaveBeenCalled()
  })

  it("keeps the scale of an image cropped by an aspect ratio", async () => {
    const setAttributes = await renderImage({
      url: "https://example.com/image.png",
      aspectRatio: "16/9",
      scale: "cover",
    })

    expect(setAttributes).not.toHaveBeenCalled()
  })

  it("waits for the natural size before judging a fully sized image", async () => {
    const setAttributes = await renderImage({
      url: "https://example.com/image.png",
      width: "400px",
      height: "200px",
      scale: "cover",
    })

    expect(setAttributes).not.toHaveBeenCalled()
  })

  it("does not touch attributes in block previews", async () => {
    editorState.isPreviewMode = true

    const setAttributes = await renderImage({
      url: "https://example.com/image.png",
      width: "auto",
      height: "200px",
      scale: "cover",
    })

    expect(setAttributes).not.toHaveBeenCalled()
  })

  it("does not run for other blocks", async () => {
    const setAttributes = await renderImage({ width: "auto", scale: "cover" }, "core/paragraph")

    expect(setAttributes).not.toHaveBeenCalled()
    expect(useSelectSpy).not.toHaveBeenCalled()
  })
})
