import type { Block } from "@/types/courseMaterialBlock"

import { diffBlockLists, markBlockChanges, markTextChanges, visibleRows } from "../blockDiff"

const block = (
  clientId: string,
  attributes?: Record<string, unknown>,
  name = "core/paragraph",
  innerBlocks: Block<unknown>[] = [],
): Block<unknown> => ({
  name,
  clientId,
  isValid: true,
  attributes: attributes ?? { content: `Text of ${clientId}` },
  innerBlocks,
})

describe("diffBlockLists", () => {
  it("pairs blocks by client id and tells what happened to each", () => {
    const rows = diffBlockLists(
      [block("a"), block("b"), block("c"), block("d")],
      [block("a"), block("b", { content: "New" }), block("d"), block("e")],
    )
    expect(rows.map((row) => row.kind)).toEqual([
      "unchanged",
      "changed",
      "removed",
      "unchanged",
      "added",
    ])
  })

  it("finds blocks that moved", () => {
    const rows = diffBlockLists(
      [block("a"), block("b"), block("c")],
      [block("b"), block("c"), block("a")],
    )
    expect(rows.map((row) => row.kind)).toEqual(["moved-away", "unchanged", "unchanged", "moved"])
  })
})

describe("visibleRows", () => {
  const rows = diffBlockLists(
    [block("a"), block("b"), block("moving"), block("removed"), block("c")],
    [block("moving"), block("a"), block("b"), block("added"), block("c")],
  )

  it("folds unchanged blocks into runs", () => {
    expect(
      visibleRows(rows, "changes").map((row) =>
        row.kind === "unchanged-run" ? row.blocks.length : row.kind,
      ),
    ).toEqual(["moved", 2, "removed", "added", 1])
  })

  it("leaves out what a side doesn't have, folding across it", () => {
    expect(visibleRows(rows, "before").map((row) => row.kind)).toEqual([
      "unchanged-run",
      "moved-away",
      "removed",
      "unchanged-run",
    ])
    expect(visibleRows(rows, "after").map((row) => row.kind)).toEqual([
      "moved",
      "unchanged-run",
      "added",
      "unchanged-run",
    ])
  })
})

describe("markTextChanges", () => {
  it("marks changed words on each side", () => {
    expect(markTextChanges("The quick fox", "The slow fox", "changes")).toBe(
      "The <del>quick</del><ins>slow</ins> fox",
    )
    expect(markTextChanges("The quick fox", "The slow fox", "before")).toBe(
      "The <del>quick</del> fox",
    )
    expect(markTextChanges("The quick fox", "The slow fox", "after")).toBe(
      "The <ins>slow</ins> fox",
    )
  })

  it("keeps a replaced phrase in one mark", () => {
    expect(markTextChanges("a b", "x y", "changes")).toBe("<del>a b</del><ins>x y</ins>")
  })

  it("keeps inline markup intact", () => {
    expect(
      markTextChanges(
        'Read <a href="/x">the old guide</a> now',
        'Read <a href="/x">the new guide</a> now',
        "changes",
      ),
    ).toBe('Read <a href="/x">the <del>old</del><ins>new</ins> guide</a> now')
  })

  it("gives up when the markup differs", () => {
    expect(markTextChanges("plain words", "<strong>plain</strong> words", "changes")).toBeNull()
  })

  it("keeps entities and shortcodes whole", () => {
    expect(markTextChanges("A &amp; B", "A &lt; B", "changes")).toBe(
      "A <del>&amp;</del><ins>&lt;</ins> B",
    )
    expect(markTextChanges("Is [latex]x^2[/latex]", "Is [latex]x^3[/latex]", "changes")).toBe(
      "Is <del>[latex]x^2[/latex]</del><ins>[latex]x^3[/latex]</ins>",
    )
  })
})

describe("markBlockChanges", () => {
  it("marks text attributes, nested in inner blocks too", () => {
    const before = block("list", {}, "core/list", [
      block("item", { content: "One" }, "core/list-item"),
    ])
    const after = block("list", {}, "core/list", [
      block("item", { content: "Two" }, "core/list-item"),
    ])
    expect(markBlockChanges(before, after, "changes")?.innerBlocks[0]?.attributes).toEqual({
      content: "<del>One</del><ins>Two</ins>",
    })
  })

  it("marks table cells", () => {
    const table = (text: string) =>
      block("t", { body: [{ cells: [{ content: text, tag: "td" }] }] }, "core/table")
    expect(markBlockChanges(table("old"), table("new"), "after")?.attributes).toEqual({
      body: [{ cells: [{ content: "<ins>new</ins>", tag: "td" }] }],
    })
  })

  it("gives up on changes that aren't text", () => {
    expect(
      markBlockChanges(
        block("h", { content: "Title", level: 2 }, "core/heading"),
        block("h", { content: "Title", level: 3 }, "core/heading"),
        "changes",
      ),
    ).toBeNull()
    expect(
      markBlockChanges(
        block("i", { url: "/a.png" }, "core/image"),
        block("i", { url: "/b.png" }, "core/image"),
        "changes",
      ),
    ).toBeNull()
    expect(
      markBlockChanges(
        block("x", { title: "Old" }, "moocfi/hero-section"),
        block("x", { title: "New" }, "moocfi/hero-section"),
        "changes",
      ),
    ).toBeNull()
    expect(
      markBlockChanges(block("p"), block("p", { content: "Text of p" }, "core/heading"), "changes"),
    ).toBeNull()
  })
})
