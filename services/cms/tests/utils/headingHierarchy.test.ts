import { BlockInstance } from "@wordpress/blocks"

import {
  analyzeHeadingHierarchy,
  getHeadingHierarchyIssuesForBlock,
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

    const issues = getHeadingHierarchyIssuesForBlock(blocks, "h3")

    expect(issues).toEqual([{ type: "heading-first-should-be-h2", level: 3 }])
  })

  it("warns when a core heading uses h1", () => {
    const blocks = [createBlock("h1", "core/heading", { level: 1, content: "Title" })]

    const issues = getHeadingHierarchyIssuesForBlock(blocks, "h1")

    expect(issues).toEqual([{ type: "heading-h1-reserved", level: 1 }])
  })

  it("warns when heading levels jump after the hero section", () => {
    const blocks = [
      createBlock("hero", "moocfi/hero-section", { title: "Page title" }),
      createBlock("h3", "core/heading", { level: 3, content: "Skipped h2" }),
    ]

    const issues = getHeadingHierarchyIssuesForBlock(blocks, "h3")

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
