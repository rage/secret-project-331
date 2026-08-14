import type { BlockInstance } from "@/utils/Gutenberg/types"

import {
  analyzeHeadingHierarchy,
  analyzeHeadingHierarchyForFlatBlocks,
  getHeadingHierarchyIssuesForBlock,
  HEADING_SOURCE_BLOCK_NAMES,
} from "../../src/utils/Gutenberg/headingHierarchy"

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

describe("analyzeHeadingHierarchy", () => {
  it("treats the hero section as h1 and allows logical heading order", () => {
    const blocks = [
      createBlock("hero", "moocfi/hero-section", { title: "Page title" }),
      createBlock("h2", "core/heading", { level: 2, content: "Overview" }),
      createBlock("h3", "core/heading", { level: 3, content: "Details" }),
      createBlock("h2b", "core/heading", { level: 2, content: "Next section" }),
    ]

    const entries = analyzeHeadingHierarchy(blocks)

    expect(entries.map((entry) => entry.level)).toEqual([1, 2, 3, 2])
    expect(entries.flatMap((entry) => entry.issues)).toEqual([])
  })

  it("warns when the first authored heading starts deeper than h2", () => {
    const blocks = [createBlock("h3", "core/heading", { level: 3, content: "Deep start" })]

    const issues = getHeadingHierarchyIssuesForBlock(analyzeHeadingHierarchy(blocks), "h3")

    expect(issues).toEqual([{ type: "heading-first-should-be-h2", level: 3 }])
  })

  it("warns when a core heading uses h1", () => {
    const blocks = [createBlock("h1", "core/heading", { level: 1, content: "Title" })]

    const issues = getHeadingHierarchyIssuesForBlock(analyzeHeadingHierarchy(blocks), "h1")

    expect(issues).toEqual([{ type: "heading-h1-reserved", level: 1 }])
  })

  it("warns when heading levels jump after the hero section", () => {
    const blocks = [
      createBlock("hero", "moocfi/hero-section", { title: "Page title" }),
      createBlock("h3", "core/heading", { level: 3, content: "Skipped h2" }),
    ]

    const issues = getHeadingHierarchyIssuesForBlock(analyzeHeadingHierarchy(blocks), "h3")

    expect(issues).toEqual([{ type: "heading-level-jump", level: 3, previousLevel: 1 }])
  })

  it("includes fixed heading levels from custom blocks in the hierarchy", () => {
    const blocks = [
      createBlock("hero", "moocfi/hero-section", { title: "Page title" }),
      createBlock("ingress", "moocfi/ingress", {
        title: "Welcome",
        subtitle: "What you will learn",
      }),
      createBlock("term", "moocfi/terminology", { title: "Key concept" }),
    ]

    const entries = analyzeHeadingHierarchy(blocks)

    expect(entries.map((entry) => [entry.blockName, entry.level, entry.text])).toEqual([
      ["moocfi/hero-section", 1, "Page title"],
      ["moocfi/ingress", 2, "Welcome"],
      ["moocfi/ingress", 3, "What you will learn"],
      ["moocfi/terminology", 2, "Key concept"],
    ])
  })

  it("includes nested heading blocks when analyzing the page outline", () => {
    const blocks = [
      createBlock("objective", "moocfi/course-objective-section", { title: "Goals" }, [
        createBlock("inner-h3", "core/heading", { level: 3, content: "Objective A" }),
      ]),
    ]

    const entries = analyzeHeadingHierarchy(blocks)

    expect(entries.map((entry) => [entry.blockClientId, entry.level, entry.text])).toEqual([
      ["objective", 2, "Goals"],
      ["inner-h3", 3, "Objective A"],
    ])
  })
})

describe("analyzeHeadingHierarchyForFlatBlocks", () => {
  const nestedDocument = [
    createBlock("hero", "moocfi/hero-section", { title: "Page title" }),
    createBlock("ingress", "moocfi/ingress", { title: "Welcome", subtitle: "What you learn" }),
    createBlock("objective", "moocfi/course-objective-section", { title: "Goals" }, [
      createBlock("inner-h5", "core/heading", { level: 5, content: "Objective A" }),
      createBlock("inner-paragraph", "core/paragraph", { content: "Body text" }),
    ]),
    createBlock("h1", "core/heading", { level: 1, content: "Second title" }),
  ]

  it("produces the same outline as the tree analysis", () => {
    expect(analyzeHeadingHierarchyForFlatBlocks(flattenBlocks(nestedDocument))).toEqual(
      analyzeHeadingHierarchy(nestedDocument),
    )
  })

  it("does not walk inner blocks, so a flattened list is not counted twice", () => {
    const entries = analyzeHeadingHierarchyForFlatBlocks([nestedDocument[2] as BlockInstance])

    expect(entries.map((entry) => entry.blockClientId)).toEqual(["objective"])
  })

  it("recognizes every block name the heading warnings subscribe to", () => {
    const entries = analyzeHeadingHierarchyForFlatBlocks(
      HEADING_SOURCE_BLOCK_NAMES.map((blockName) =>
        createBlock(blockName, blockName, { level: 2, content: blockName, title: blockName }),
      ),
    )

    expect(entries.map((entry) => entry.blockName)).toEqual(HEADING_SOURCE_BLOCK_NAMES)
  })
})
