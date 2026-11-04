/**
 * @jest-environment jsdom
 */

import { TextEncoder } from "util"

import {
  createBlock,
  getPossibleBlockTransformations,
  registerBlockType,
  switchToBlockType,
} from "@wordpress/blocks"

import type { BlockInstance } from "@/utils/Gutenberg/types"

import {
  TRANSFORMS_TO_ASIDE,
  TRANSFORMS_TO_EXPANDABLE,
  TRANSFORMS_TO_INFOBOX,
} from "../../src/blocks/containerTransforms"

// jsdom lacks TextEncoder, which block-library's dependencies use at import time.
globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder
const { __experimentalGetCoreBlocks } = await import("@wordpress/block-library")

const CORE_BLOCKS = ["core/paragraph", "core/heading", "core/image", "core/list", "core/table"]

/** Only names, attributes and transforms matter here, so the course blocks are stand-ins. */
const COURSE_BLOCKS: Record<string, [Record<string, { type: string }>, unknown[]]> = {
  "moocfi/infobox": [{}, TRANSFORMS_TO_INFOBOX],
  "moocfi/aside": [{}, TRANSFORMS_TO_ASIDE],
  "moocfi/expandable-content": [{}, TRANSFORMS_TO_EXPANDABLE],
  "moocfi/expandable-content-inner-block": [{ name: { type: "string" } }, []],
  "moocfi/aside-with-image": [
    { title: { type: "string" }, content: { type: "string" }, headingLevel: { type: "number" } },
    [],
  ],
}

beforeAll(() => {
  for (const block of __experimentalGetCoreBlocks()) {
    if (CORE_BLOCKS.includes(block.name)) {
      block.init()
    }
  }
  for (const [name, [attributes, transforms]] of Object.entries(COURSE_BLOCKS)) {
    registerBlockType(name, {
      apiVersion: 3,
      title: name,
      category: "text",
      attributes,
      save: () => null,
      transforms: { from: transforms },
    } as never)
  }
})

const paragraph = (content: string) => createBlock("core/paragraph", { content })
const heading = (content: string, level = 3) => createBlock("core/heading", { content, level })
const section = (name: string, innerBlocks: BlockInstance[]) =>
  createBlock("moocfi/expandable-content-inner-block", { name }, innerBlocks)

const switchTo = (block: BlockInstance, name: string) => {
  const result = switchToBlockType(block, name)
  expect(result).toHaveLength(1)
  return (result as BlockInstance[])[0] as BlockInstance
}

const offeredFor = (block: BlockInstance) =>
  getPossibleBlockTransformations([block])
    .map((blockType) => blockType.name)
    .filter((name) => name.startsWith("moocfi/"))
    .toSorted()

/** Block names and the text-bearing attributes, nested, for readable assertions. */
const outline = (block: BlockInstance): unknown => {
  const { content, name, level, title } = block.attributes as Record<string, unknown>
  const text = content ?? name ?? title
  return [
    block.name,
    ...(text === undefined ? [] : [String(text)]),
    ...(level === undefined ? [] : [level]),
    ...block.innerBlocks.map(outline),
  ]
}

describe("container block transforms", () => {
  it("turns an info box into an aside, keeping its blocks", () => {
    const infobox = createBlock("moocfi/infobox", {}, [heading("Note"), paragraph("Body")])

    expect(outline(switchTo(infobox, "moocfi/aside"))).toEqual([
      "moocfi/aside",
      ["core/heading", "Note", 3],
      ["core/paragraph", "Body"],
    ])
  })

  it("splits an info box into one expandable section per heading", () => {
    const infobox = createBlock("moocfi/infobox", {}, [
      paragraph("Intro"),
      heading("First &amp; best"),
      paragraph("One"),
      heading("Second"),
      paragraph("Two"),
    ])

    expect(outline(switchTo(infobox, "moocfi/expandable-content"))).toEqual([
      "moocfi/expandable-content",
      ["moocfi/expandable-content-inner-block", "", ["core/paragraph", "Intro"]],
      ["moocfi/expandable-content-inner-block", "First & best", ["core/paragraph", "One"]],
      ["moocfi/expandable-content-inner-block", "Second", ["core/paragraph", "Two"]],
    ])
  })

  it("turns expandable sections back into headings followed by their content", () => {
    const expandable = createBlock("moocfi/expandable-content", {}, [
      section("A < B", [paragraph("One")]),
      section("", [paragraph("Two")]),
    ])

    expect(outline(switchTo(expandable, "moocfi/infobox"))).toEqual([
      "moocfi/infobox",
      ["core/heading", "A &lt; B", 4],
      ["core/paragraph", "One"],
      ["core/paragraph", "Two"],
    ])
  })

  it("keeps deeper headings inside the sections", () => {
    const infobox = createBlock("moocfi/infobox", {}, [
      heading("Example", 3),
      heading("Step 1", 4),
      paragraph("One"),
    ])

    expect(outline(switchTo(infobox, "moocfi/expandable-content"))).toEqual([
      "moocfi/expandable-content",
      [
        "moocfi/expandable-content-inner-block",
        "Example",
        ["core/heading", "Step 1", 4],
        ["core/paragraph", "One"],
      ],
    ])
  })

  it("keeps sections with headings inside them intact through a box and back", () => {
    const expandable = createBlock("moocfi/expandable-content", {}, [
      section("Setup", [heading("Windows", 3), paragraph("Install")]),
      section("Use", [paragraph("Run")]),
    ])

    const roundTripped = switchTo(switchTo(expandable, "moocfi/aside"), "moocfi/expandable-content")

    expect(outline(roundTripped)).toEqual(outline(expandable))
  })

  it("turns an aside with image into a box with its heading, image and text", () => {
    const aside = createBlock(
      "moocfi/aside-with-image",
      { title: "<strong>Ethics</strong>", content: "Body", headingLevel: 3 },
      [createBlock("core/image", { url: "https://example.com/icon.svg" })],
    )

    expect(outline(switchTo(aside, "moocfi/aside"))).toEqual([
      "moocfi/aside",
      ["core/heading", "<strong>Ethics</strong>", 3],
      ["core/image"],
      ["core/paragraph", "Body"],
    ])
  })

  it("does not offer expandable content when a block would not fit in a section", () => {
    const infobox = createBlock("moocfi/infobox", {}, [
      paragraph("Body"),
      createBlock("core/table"),
    ])

    const offered = getPossibleBlockTransformations([infobox]).map((blockType) => blockType.name)

    expect(offered).toContain("moocfi/aside")
    expect(offered).not.toContain("moocfi/expandable-content")
  })

  it("offers each container the others it can become without losing content", () => {
    expect(offeredFor(createBlock("moocfi/infobox", {}, [paragraph("Body")]))).toEqual([
      "moocfi/aside",
      "moocfi/expandable-content",
    ])
    expect(offeredFor(createBlock("moocfi/expandable-content", {}, []))).toEqual([
      "moocfi/aside",
      "moocfi/infobox",
    ])
    expect(offeredFor(createBlock("moocfi/aside-with-image", {}, []))).toEqual([
      "moocfi/aside",
      "moocfi/infobox",
    ])
  })
})
