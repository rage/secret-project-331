import type { Block } from "@/types/courseMaterialBlock"

import { blockGapRem } from "../blockGap"
import { isEmptyBlock } from "../isEmptyBlock"

const block = (
  name: string,
  attributes: Record<string, unknown> = {},
  innerBlocks: Block<unknown>[] = [],
): Block<unknown> => ({
  name,
  clientId: name,
  isValid: true,
  attributes,
  innerBlocks,
})

const paragraph = (content = "Text") => block("core/paragraph", { content })
const heading = (level: number) => block("core/heading", { content: "Title", level })

describe("blockGapRem", () => {
  test("first block has no gap", () => {
    expect(blockGapRem(undefined, paragraph())).toBe(0)
  })

  test("headings sit closer to what follows than to what precedes", () => {
    expect(blockGapRem(paragraph(), heading(2))).toBeGreaterThan(
      blockGapRem(heading(2), paragraph()),
    )
    expect(blockGapRem(paragraph(), heading(2))).toBeGreaterThan(
      blockGapRem(paragraph(), heading(4)),
    )
  })

  test("text runs are tighter than gaps around other blocks", () => {
    expect(blockGapRem(paragraph(), paragraph())).toBeLessThan(
      blockGapRem(paragraph(), block("core/image")),
    )
  })

  test("same-kind boxes group together", () => {
    expect(blockGapRem(block("moocfi/aside"), block("moocfi/aside"))).toBeLessThan(
      blockGapRem(paragraph(), block("moocfi/aside")),
    )
  })

  test("a spacer is the only gap next to it", () => {
    expect(blockGapRem(paragraph(), block("core/spacer"))).toBe(0)
    expect(blockGapRem(block("core/spacer"), paragraph())).toBe(0)
  })
})

describe("isEmptyBlock", () => {
  test("text blocks without visible text are empty", () => {
    expect(isEmptyBlock(paragraph(""))).toBe(true)
    expect(isEmptyBlock(paragraph("<br>&nbsp; "))).toBe(true)
    expect(isEmptyBlock(paragraph("Hello"))).toBe(false)
    expect(isEmptyBlock(paragraph('<img src="a.png" alt="">'))).toBe(false)
  })

  test("blocks with an anchor stay, so links to them keep working", () => {
    expect(isEmptyBlock(block("core/paragraph", { content: "", anchor: "here" }))).toBe(false)
  })

  test("media and code without content are empty", () => {
    expect(isEmptyBlock(block("core/image", { url: "" }))).toBe(true)
    expect(isEmptyBlock(block("moocfi/latex", { text: " " }))).toBe(true)
    expect(isEmptyBlock(block("core/code", { content: "" }))).toBe(true)
  })

  test("containers are empty only when all their children are", () => {
    expect(isEmptyBlock(block("moocfi/aside", {}, [paragraph("")]))).toBe(true)
    expect(isEmptyBlock(block("moocfi/aside", {}, [paragraph("Note")]))).toBe(false)
  })

  test("blocks it knows nothing about are never empty", () => {
    expect(isEmptyBlock(block("moocfi/exercise"))).toBe(false)
  })
})
