/**
 * @jest-environment node
 */

import { callBlockValidator } from "@/blockValidator/validatorWorker"

import {
  block,
  startBuiltValidator,
  stopBlockValidator,
  type TestBlock,
  validate,
} from "./runValidator"

beforeAll(startBuiltValidator, 120_000)
afterAll(stopBlockValidator)

const paragraph = (content: string) => block("core/paragraph", { content })

const firstContent = async (name: string, attribute: string, value: string) => {
  const result = await validate([block(name, { [attribute]: value })])
  expect(result.errors).toEqual([])
  return result.blocks[0]?.attributes[attribute]
}

const errorCodes = async (
  blocks: TestBlock[],
  pageType?: string,
  extra?: Record<string, unknown>,
) => (await validate(blocks, pageType, extra)).errors.map((error) => [error.clientId, error.code])

describe("valid documents", () => {
  it("pass unchanged when already in the stored form", async () => {
    const document = [
      block("core/heading", { content: "Intro to <em>sets</em>", level: 2 }),
      block("core/paragraph", {
        content:
          'A <strong>set</strong> is <a href="https://example.com/sets" target="_blank" rel="noopener">a collection</a>.<br>Next line',
        dropCap: false,
      }),
      block("core/list", { ordered: false, values: "" }, [
        block("core/list-item", { content: "one" }),
        block("core/list-item", { content: "two" }, [
          block("core/list", { ordered: true, values: "" }, [
            block("core/list-item", { content: "nested" }),
          ]),
        ]),
      ]),
      block("moocfi/exercise", { id: "9f1c4a60-7d0e-4b9b-9a51-0c4b1c2f3d4e" }),
      block("moocfi/flip-card", { size: "xl" }, [
        block("moocfi/front-card", {}, [
          block("core/paragraph", { content: "Front", dropCap: false }),
        ]),
        block("moocfi/back-card", {}, [
          block("core/paragraph", { content: "Back", dropCap: false }),
        ]),
      ]),
    ]
    const result = await validate(document)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
    expect(result.blocks).toEqual(document)
  })

  it("is idempotent: normalised output validates to itself", async () => {
    const first = await validate([
      block("core/image", { url: "https://example.com/a.png", alt: "A cat" }),
      block("core/table", { body: [{ cells: [{ content: "<em>x</em>" }] }] }),
      block("moocfi/hero-section", { title: "Chapter&nbsp;1" }),
    ])
    expect(first.errors).toEqual([])
    const second = await validate(first.blocks)
    expect(second.blocks).toEqual(first.blocks)
  })
})

describe("normalisation", () => {
  it("decodes entities, lowercases tags and orders link attributes as the editor does", async () => {
    expect(
      await firstContent(
        "core/paragraph",
        "content",
        '&copy; &gt; <A rel="noopener" TARGET="_blank" HREF="https://x.fi">x</A>',
      ),
    ).toBe('© > <a href="https://x.fi" target="_blank" rel="noopener">x</a>')
  })

  it("merges adjacent equal formats and drops empty ones", async () => {
    expect(
      await firstContent("core/paragraph", "content", "<em>a</em><em>b</em><strong></strong>"),
    ).toBe("<em>ab</em>")
  })

  it("writes line breaks as <br>", async () => {
    expect(await firstContent("core/paragraph", "content", "a<br/>b<br />c")).toBe("a<br>b<br>c")
  })

  it("applies the save-time space normalisation to paragraphs only", async () => {
    expect(await firstContent("core/paragraph", "content", "a&nbsp;b\u2009c")).toBe("a b c")
    const listResult = await validate([
      block("core/list", {}, [block("core/list-item", { content: "a&nbsp;b" })]),
    ])
    expect(listResult.blocks[0]?.innerBlocks[0]?.attributes.content).toBe("a\u00A0b")
  })

  it("fills defaults in registration order as createBlock does", async () => {
    const result = await validate([block("moocfi/iframe", { url: "https://example.com" })])
    expect(Object.keys(result.blocks[0]?.attributes ?? {})).toEqual(["url", "heightPx"])
    expect(result.blocks[0]?.attributes).toEqual({ url: "https://example.com", heightPx: 630 })
  })

  it("fills table cell defaults", async () => {
    const result = await validate([block("core/table", { body: [{ cells: [{ content: "x" }] }] })])
    expect(result.blocks[0]?.attributes.body).toEqual([{ cells: [{ content: "x", tag: "td" }] }])
  })

  it("generates MathML from the LaTeX of inline math", async () => {
    const content = await firstContent(
      "core/paragraph",
      "content",
      '<math data-latex="x^2"></math>',
    )
    expect(content).toMatch(
      /^<math data-latex="x\^2"><semantics><msup><mi>x<\/mi><mn>2<\/mn><\/msup>/,
    )
  })

  it("keeps clientIds and order and sets isValid", async () => {
    const blocks = [paragraph("a"), paragraph("b"), paragraph("c")].map(
      ({ isValid: _isValid, ...rest }) => rest,
    )
    const result = await validate(blocks)
    expect(result.blocks.map((b) => [b.clientId, b.isValid])).toEqual(
      blocks.map((b) => [b.clientId, true]),
    )
  })
})

describe("rich text is strict, including markup that was already there", () => {
  it.each([
    ["<b>bold</b>", "Use <strong> instead of <b>."],
    ["<i>it</i>", "Use <em> instead of <i>."],
    ["<u>u</u>", 'Use <span style="text-decoration: underline;"> instead of <u>.'],
    ['<span style="color:red">x</span>', undefined],
    ["<p>para</p>", undefined],
    ["<!-- note -->x", "Remove the comment."],
    ["<script>alert(1)</script>", undefined],
    ['<a href="https://x.fi" onclick="x()">x</a>', undefined],
    ['<a href="javascript:alert(1)">x</a>', undefined],
    ['<a href="https://x.fi" target="_blank">x</a>', undefined],
    ['<a href="https://x.fi" data-type="page">x</a>', undefined],
    ['<img src="https://x.fi/a.png">', undefined],
    ['<mark class="has-inline-color" style="color:red">x</mark>', undefined],
    ["<strong><strong>x</strong></strong>", "Remove the inner <strong>."],
    ["a\r\nb", undefined],
    ['<math data-latex="\\frac{"></math>', "Correct the LaTeX in data-latex."],
  ])("rejects %s", async (content, fix) => {
    const result = await validate([paragraph(content)])
    expect(result.valid).toBe(false)
    expect(result.errors[0]?.code).toBe("disallowed_markup")
    expect(result.errors[0]?.path).toEqual(["attributes", "content"])
    if (fix !== undefined) {
      expect(result.errors[0]?.fix).toBe(fix)
    }
  })

  it.each([
    '<span style="text-decoration: underline;">u</span>',
    '<mark style="background-color:rgba(0, 0, 0, 0)" class="has-inline-color has-vivid-red-color">x</mark>',
    '<mark style="background-color:rgba(0, 0, 0, 0);color:#123456" class="has-inline-color">x</mark>',
    '<bdo lang="fi" dir="ltr">moi</bdo>',
    "<code>x</code><s>y</s><sub>1</sub><sup>2</sup><kbd>K</kbd>",
    '<a href="/relative">x</a> <a href="mailto:a@b.fi" rel="nofollow">m</a>',
  ])("accepts %s", async (content) => {
    expect((await validate([paragraph(content)])).errors).toEqual([])
  })

  it("rejects links where the editor offers none", async () => {
    const result = await validate([
      block("core/buttons", {}, [block("core/button", { text: '<a href="https://x.fi">go</a>' })]),
    ])
    expect(result.errors.map((error) => [error.code, error.path])).toEqual([
      ["disallowed_markup", ["attributes", "text"]],
    ])
  })

  it("checks rich text inside table cells with the cell's path", async () => {
    const result = await validate([
      block("core/table", { body: [{ cells: [{ content: "ok" }, { content: "<b>x</b>" }] }] }),
    ])
    expect(result.errors[0]?.path).toEqual(["attributes", "body", 0, "cells", 1, "content"])
  })

  it("treats custom rich-text attributes as rich text", async () => {
    const result = await validate([
      block("moocfi/terminology-block", { blockName: "<b>Terms</b>" }, [paragraph("x")]),
    ])
    expect(result.errors.map((error) => error.code)).toEqual(["disallowed_markup"])
  })
})

describe("attributes", () => {
  it("rejects unknown attributes and wrong types", async () => {
    const result = await validate([
      block("core/paragraph", { content: "x", bogus: 1, dropCap: "yes" }),
      block("core/heading", { content: "x", level: 2.5 }),
    ])
    expect(result.errors.map((error) => [error.code, error.path])).toEqual([
      ["invalid_attribute", ["attributes", "bogus"]],
      ["invalid_attribute", ["attributes", "dropCap"]],
      ["invalid_attribute", ["attributes", "level"]],
    ])
  })

  it("rejects enum misses", async () => {
    const result = await validate([block("core/paragraph", { content: "x", align: "middle" })])
    expect(result.errors[0]?.code).toBe("invalid_attribute")
  })

  it("forbids style and metadata objects", async () => {
    const result = await validate([
      block("core/paragraph", { content: "x", style: { color: { text: "red" } }, metadata: {} }),
    ])
    expect(result.errors.map((error) => [error.code, error.path])).toEqual([
      ["forbidden_attribute", ["attributes", "style"]],
      ["forbidden_attribute", ["attributes", "metadata"]],
    ])
  })

  it("checks embed providers and URLs", async () => {
    const result = await validate([
      block("core/embed", {
        url: "https://www.youtube.com/watch?v=x",
        providerNameSlug: "youtube",
      }),
      block("core/embed", { url: "https://x.fi", providerNameSlug: "flickr" }),
      block("core/image", { url: "javascript:alert(1)" }),
    ])
    expect(result.errors.map((error) => [error.clientId, error.path])).toEqual([
      [result.blocks[1]?.clientId, ["attributes", "providerNameSlug"]],
      [result.blocks[2]?.clientId, ["attributes", "url"]],
    ])
  })

  it("rejects chart specs that don't render", async () => {
    const spec = JSON.stringify({
      data: { values: [{ a: 1 }] },
      mark: "bar",
      encoding: { x: { field: "a", type: "nonsense" } },
    })
    const result = await validate([block("moocfi/chart", { spec })])
    expect(result.errors.map((error) => error.path)).toEqual([["attributes", "spec"]])
  })

  it("keeps exercise blocks opaque", async () => {
    const result = await validate([
      block("moocfi/exercise", { id: "e1", name: "Changed" }),
      block("moocfi/exercise", { id: "e2" }, [block("moocfi/exercise-settings")]),
    ])
    expect(result.errors.map((error) => error.code)).toEqual([
      "invalid_attribute",
      "invalid_attribute",
    ])
  })
})

describe("allow-lists per page type", () => {
  it.each([
    ["course-page", "moocfi/landing-page-hero-section", false],
    ["course-front-page", "moocfi/landing-page-hero-section", true],
    ["course-front-page", "moocfi/hero-section", false],
    ["top-level-page", "moocfi/hero-section", true],
    ["top-level-page", "moocfi/exercises-in-chapter", false],
    ["chapter-front-page", "moocfi/pages-in-chapter", true],
  ])("on %s, %s allowed: %s", async (pageType, name, isAllowed) => {
    const result = await validate([block(name)], pageType)
    expect(result.errors.some((error) => error.code === "not_allowed_here")).toBe(!isAllowed)
  })

  it("offers lock-chapter and chatbot only when the course enables them", async () => {
    const blocks = [block("moocfi/lock-chapter"), block("moocfi/chatbot")]
    expect((await validate(blocks)).errors.map((error) => error.code)).toEqual([
      "not_allowed_here",
      "not_allowed_here",
    ])
    expect(
      (
        await validate(blocks, "course-page", {
          chapter_locking_enabled: true,
          can_add_chatbot: true,
        })
      ).errors,
    ).toEqual([])
  })

  it.each(["core/html", "core/block", "moocfi/unsupported-block-type", "moocfi/exercise-task"])(
    "never accepts %s from agents",
    async (name) => {
      expect(await errorCodes([block(name)])).toEqual([[expect.any(String), "not_allowed_here"]])
    },
  )

  it("rejects unknown blocks", async () => {
    expect(await errorCodes([block("moocfi/nope")])).toEqual([
      [expect.any(String), "unknown_block"],
    ])
  })
})

const author = (columns: TestBlock[]) =>
  block("moocfi/author", {}, [
    block("moocfi/author-inner-block", {}, [block("core/columns", {}, columns)]),
  ])

describe("nesting", () => {
  it("follows parent and allow-list rules", async () => {
    const outsideList = block("core/list-item", { content: "x" })
    const outsideColumns = block("core/column")
    const inLeaf = block("core/paragraph", { content: "x" }, [paragraph("y")])
    const notAllowedChild = block("moocfi/aside-with-image", {}, [paragraph("x")])
    expect(await errorCodes([outsideList, outsideColumns, inLeaf, notAllowedChild])).toEqual([
      [outsideList.clientId, "invalid_nesting"],
      [outsideColumns.clientId, "invalid_nesting"],
      [inLeaf.clientId, "invalid_nesting"],
      [notAllowedChild.innerBlocks[0]?.clientId, "invalid_nesting"],
    ])
  })

  it("keeps exercises at the top level", async () => {
    const exercise = block("moocfi/exercise", { id: "e1" })
    expect(await errorCodes([block("moocfi/aside", {}, [exercise])])).toEqual([
      [exercise.clientId, "invalid_nesting"],
    ])
  })

  it("lets children allowed by their own parent field in", async () => {
    const result = await validate([
      block("moocfi/expandable-content", {}, [
        block("moocfi/expandable-content-inner-block", { name: "More" }, [paragraph("x")]),
      ]),
      block("moocfi/revelable-content", {}, [
        block("moocfi/revealable-hidden-content", {}, [paragraph("x")]),
      ]),
    ])
    expect(result.errors).toEqual([])
  })

  it("enforces locked templates", async () => {
    const flipCard = block("moocfi/flip-card", {}, [
      block("moocfi/back-card"),
      block("moocfi/front-card"),
    ])
    const tableBox = block("moocfi/tablebox", {}, [block("core/table"), block("core/table")])
    expect(await errorCodes([flipCard, tableBox])).toEqual([
      [flipCard.clientId, "invalid_nesting"],
      [tableBox.clientId, "invalid_nesting"],
    ])
  })

  it("enforces an inherited insert lock through nested template entries", async () => {
    const matching = author([
      block("core/column", {}, [block("core/image", { url: "https://x.fi/a.png" })]),
      block("core/column", {}, [paragraph("Bio")]),
    ])
    expect((await validate([matching])).errors).toEqual([])
    const extraColumn = author([
      block("core/column", {}, [block("core/image")]),
      block("core/column", {}, [paragraph("Bio")]),
      block("core/column", {}, [paragraph("More")]),
    ])
    expect((await validate([extraColumn])).errors.map((error) => error.code)).toEqual([
      "invalid_nesting",
    ])
  })

  it("requires template children where the editor would insert them", async () => {
    const terminology = block("moocfi/terminology-block")
    expect(await errorCodes([terminology])).toEqual([[terminology.clientId, "invalid_nesting"]])
  })
})

describe("batches", () => {
  it("reports every error against its own block and keeps the rest", async () => {
    const good = paragraph("fine")
    const badMarkup = paragraph("<b>x</b>")
    const badName = block("core/aside")
    const result = await validate([good, badMarkup, badName])
    expect(result.valid).toBe(false)
    expect(result.errors.map((error) => [error.clientId, error.code])).toEqual([
      [badMarkup.clientId, "disallowed_markup"],
      [badName.clientId, "unknown_block"],
    ])
    expect(result.blocks.map((b) => b.clientId)).toEqual([
      good.clientId,
      badMarkup.clientId,
      badName.clientId,
    ])
  })

  it("rejects duplicate clientIds and malformed blocks", async () => {
    const first = paragraph("a")
    const result = await validate([
      first,
      { ...paragraph("b"), clientId: first.clientId },
      { name: "core/paragraph", attributes: {} },
      { ...paragraph("c"), innerBlocks: "none" },
      { ...paragraph("d"), extra: true },
    ])
    expect(result.errors.map((error) => error.code)).toEqual([
      "duplicate_client_id",
      "invalid_block",
      "invalid_block",
      "invalid_block",
    ])
    expect(result.errors[1]?.path).toEqual(["blocks", 2])
  })

  it("answers 400 to a malformed request", async () => {
    for (const body of [
      null,
      { blocks: [] },
      { page_type: "exam", blocks: [] },
      { page_type: "course-page" },
    ]) {
      const response = await callBlockValidator({ kind: "validate", body })
      expect(response.status).toBe(400)
    }
  })
})
