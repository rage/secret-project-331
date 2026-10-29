/**
 * @jest-environment node
 */

import { callBlockValidator } from "@/blockValidator/validatorWorker"

import {
  block,
  NO_COURSE_FEATURES,
  startBuiltValidator,
  stopBlockValidator,
  type TestBlock,
  validate,
  validateInExercise,
  type ValidationBody,
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
    expect(result.errors).toEqual([])
    expect(result.blocks).toEqual(document)
  })

  it("is idempotent: normalised output validates to itself", async () => {
    const first = await validate([
      block("core/image", { url: "https://example.com/a.png", alt: "A cat" }),
      block("core/table", { body: [{ cells: [{ content: "<em>x</em>" }] }] }),
      block("moocfi/hero-section", { title: "Chapter &amp; verse" }),
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

  it("rejects special spaces where the page save would replace them, and keeps them elsewhere", async () => {
    const result = await validate([
      paragraph("10&nbsp;km"),
      block("moocfi/hero-section", { title: "a\u2009b" }),
      block("core/list", {}, [block("core/list-item", { content: "a&nbsp;b" })]),
    ])
    expect(result.errors.map((error) => [error.code, error.path])).toEqual([
      ["disallowed_markup", ["attributes", "content"]],
      ["disallowed_markup", ["attributes", "title"]],
    ])
    expect(result.blocks[2]?.innerBlocks[0]?.attributes.content).toBe("a\u00A0b")
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
    ["a&#xFEFF;b", undefined],
    ["a&#13;b", undefined],
    ["&#xFFFC;", undefined],
    ['<a href="https://x.fi" class="x;}body{">x</a>', undefined],
    ["<constructor>x</constructor>", undefined],
    ["<toString>x</toString>", undefined],
    ['<math data-latex="\\frac{"></math>', "Correct the LaTeX in data-latex."],
  ])("rejects %s", async (content, fix) => {
    const result = await validate([paragraph(content)])
    expect(result.errors).not.toEqual([])
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
    '<a href="/relative">x</a> <a href="mailto:a@example.com" rel="nofollow">m</a>',
    '<a href="https://x.fi" class="button-link is-large">x</a>',
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

  it("rejects null for attributes that can't be null", async () => {
    const result = await validate([block("core/paragraph", { content: null })])
    expect(result.errors.map((error) => [error.code, error.path])).toEqual([
      ["invalid_attribute", ["attributes", "content"]],
    ])
  })

  it("treats attribute and block names from the input as data, not object keys", async () => {
    const result = await validate([
      block("core/paragraph", { content: "x", constructor: 1, toString: "y" }),
      block("constructor"),
      block("__proto__"),
    ])
    expect(result.errors.map((error) => [error.code, error.path])).toEqual([
      ["invalid_attribute", ["attributes", "constructor"]],
      ["invalid_attribute", ["attributes", "toString"]],
      ["unknown_block", ["name"]],
      ["unknown_block", ["name"]],
    ])
  })

  it.each([
    ["moocfi/infobox", "backgroundColor", "red;}body{display:none}.x{", "#faf5f3"],
    ["moocfi/aside", "separatorColor", "url(https://x.fi/a.png)", "#007acc"],
    ["moocfi/terminology-block", "primaryColor", "red", "#663399"],
    ["moocfi/hero-section", "fontColor", "#000;}*{x:y", "#333"],
    ["moocfi/tablebox", "width", "1;}body{display:none}.x{", "800"],
    ["moocfi/flip-card", "size", "huge", "m"],
    ["core/paragraph", "textColor", "red;}body{", "vivid-red"],
    ["core/columns", "verticalAlignment", "center;}body{", "center"],
    ["core/image", "width", "100px;}body{", "300px"],
    ["core/image", "aspectRatio", "1;}body{", "16/9"],
    ["core/spacer", "height", "1px;}body{", "var:preset|spacing|40"],
  ])("rejects CSS in %s %s", async (name, attribute, injected, valid) => {
    const withChildren = (attributes: Record<string, unknown>) =>
      name === "moocfi/terminology-block"
        ? block(name, attributes, [paragraph("x")])
        : name === "moocfi/flip-card"
          ? block(name, attributes, [block("moocfi/front-card"), block("moocfi/back-card")])
          : name === "moocfi/tablebox"
            ? block(name, attributes, [block("core/table")])
            : block(name, attributes)
    const rejected = await validate([withChildren({ [attribute]: injected })])
    expect(rejected.errors.map((error) => error.path)).toEqual([["attributes", attribute]])
    expect((await validate([withChildren({ [attribute]: valid })])).errors).toEqual([])
  })

  it("restricts table cell tags, scopes, alignment and spans", async () => {
    const result = await validate([
      block("core/table", {
        body: [
          {
            cells: [
              { content: "a", tag: "script" },
              { content: "b", tag: "th", scope: "everything" },
              { content: "c", align: "left;}body{" },
              { content: "d", colspan: "2;" },
              { content: "e", tag: "th", scope: "row", align: "center", colspan: "2" },
            ],
          },
        ],
      }),
    ])
    expect(result.errors.map((error) => error.path)).toEqual([
      ["attributes", "body", 0, "cells", 0, "tag"],
      ["attributes", "body", 0, "cells", 1, "scope"],
      ["attributes", "body", 0, "cells", 2, "align"],
      ["attributes", "body", 0, "cells", 3, "colspan"],
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
    ["course-page", "moocfi/pages-in-chapter", true],
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
        await validate(
          blocks,
          "course-page",
          {},
          {
            chapter_locking_enabled: true,
            can_add_chatbot: true,
          },
        )
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

describe("exercise instruction contexts", () => {
  it.each([
    ["task_instructions", "core/paragraph", true],
    ["task_instructions", "moocfi/iframe", true],
    ["task_instructions", "moocfi/latex", true],
    ["task_instructions", "core/table", true],
    ["task_instructions", "moocfi/hero-section", false],
    ["task_instructions", "moocfi/exercise", false],
    ["review_instructions", "core/paragraph", true],
    ["review_instructions", "moocfi/latex", true],
    ["review_instructions", "core/image", true],
    ["review_instructions", "moocfi/iframe", false],
    ["review_instructions", "core/table", false],
  ] as const)("in %s, %s allowed: %s", async (context, name, isAllowed) => {
    const result = await validateInExercise([block(name)], context)
    expect(result.errors.length === 0).toBe(isAllowed)
  })

  it("keeps raw HTML and reusable blocks forbidden", async () => {
    const result = await validateInExercise(
      [block("core/html", { content: "<b>x</b>" }), block("core/block", { ref: 1 })],
      "task_instructions",
    )
    expect(result.errors.map((error) => error.code)).toEqual([
      "not_allowed_here",
      "not_allowed_here",
    ])
  })

  it("checks nested blocks against their ancestors", async () => {
    const valid = await validateInExercise(
      [block("core/list", {}, [block("core/list-item", { content: "a" })])],
      "review_instructions",
    )
    expect(valid.errors).toEqual([])
    const misplaced = await validateInExercise(
      [block("core/list-item", { content: "a" })],
      "task_instructions",
    )
    expect(misplaced.errors.map((error) => error.code)).toEqual(["invalid_nesting"])
  })

  it("checks attributes as on a page", async () => {
    const result = await validateInExercise(
      [block("core/paragraph", { bogus: 1 })],
      "task_instructions",
    )
    expect(result.errors.map((error) => error.code)).toEqual(["invalid_attribute"])
  })
})

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

  it("lets a teacher reorder the children of an inherited insert lock", async () => {
    const swapped = author([
      block("core/column", {}, [paragraph("Bio")]),
      block("core/column", {}, [block("core/image", { url: "https://x.fi/a.png" })]),
    ])
    expect((await validate([swapped])).errors).toEqual([])
  })

  it("accepts an unlocked template block that the teacher emptied", async () => {
    expect(await errorCodes([block("moocfi/terminology-block", { title: "Terms" })])).toEqual([])
  })

  it("reports children that aren't blocks instead of failing on a locked template", async () => {
    const flipCard = block("moocfi/flip-card", {}, [])
    const result = await validate([
      { ...flipCard, innerBlocks: [null, block("moocfi/back-card")] },
      author([
        { ...block("core/column"), innerBlocks: [null] as unknown as TestBlock[] },
        block("core/column", {}, [paragraph("Bio")]),
      ]),
    ])
    expect(result.errors.map((error) => error.code)).toEqual([
      "invalid_block",
      "invalid_nesting",
      "invalid_block",
    ])
  })
})

describe("blocks the teacher wrote", () => {
  it("are type-checked but exempt from the rules about what agents write", async () => {
    const html = block("core/html", { content: '<iframe src="https://x.fi"></iframe>' })
    const styled = block("core/paragraph", {
      content: "Centred&nbsp;text",
      style: { typography: { textAlign: "center" } },
    })
    const lock = block("moocfi/lock-chapter", {}, [paragraph("Model solution")])
    const changed = paragraph("The agent's edit")
    const expandable = block("moocfi/expandable-content", {}, [
      block("moocfi/expandable-content-inner-block", { name: "More" }, [html, styled, changed]),
    ])
    const unchangedClientIds = [expandable, ...expandable.innerBlocks, html, styled, lock].map(
      (b) => b.clientId,
    )
    const result = await validate([expandable, lock], "course-page", {
      unchanged_client_ids: unchangedClientIds,
    })
    expect(result.errors).toEqual([])
    const inner = result.blocks[0]?.innerBlocks[0]?.innerBlocks
    expect(inner?.[0]?.attributes.content).toBe(html.attributes.content)
    expect(inner?.[1]?.attributes.style).toEqual({ typography: { textAlign: "center" } })
    expect(inner?.[1]?.attributes.content).toBe("Centred\u00A0text")

    const asAgentWrites = await validate([expandable, lock])
    expect(asAgentWrites.errors.map((error) => [error.clientId, error.code])).toEqual([
      [html.clientId, "not_allowed_here"],
      [styled.clientId, "forbidden_attribute"],
      [styled.clientId, "disallowed_markup"],
      [lock.clientId, "not_allowed_here"],
    ])
  })

  it("only warn about their own markup and attributes, kept as they are", async () => {
    const legacy = paragraph("<b>old</b>")
    const result = await validate([legacy], "course-page", {
      unchanged_client_ids: [legacy.clientId],
    })
    expect(result.errors).toEqual([])
    expect(result.errors).toEqual([])
    expect(result.warnings.map((warning) => [warning.clientId, warning.code])).toEqual([
      [legacy.clientId, "disallowed_markup"],
    ])
    expect(result.blocks).toEqual([legacy])
  })

  it("warn about markup from the AI paragraph toolbar, which fails a block the agent wrote", async () => {
    const content =
      '<span style="text-decoration:underline">Underlined</span> and <span class="has-large-font-size">large</span>'
    const teachers = paragraph(content)
    const kept = await validate([teachers], "course-page", {
      unchanged_client_ids: [teachers.clientId],
    })
    expect(kept.errors).toEqual([])
    expect(kept.blocks).toEqual([teachers])
    expect(
      new Set(kept.warnings.map((warning) => [warning.clientId, warning.code].join())),
    ).toEqual(new Set([[teachers.clientId, "disallowed_markup"].join()]))

    const agents = paragraph(content)
    const written = await validate([agents])
    expect(written.errors).not.toEqual([])
    expect(new Set(written.errors.map((error) => [error.clientId, error.code].join()))).toEqual(
      new Set([[agents.clientId, "disallowed_markup"].join()]),
    )
    expect(written.warnings).toEqual([])
  })

  it("still fail where the agent placed them", async () => {
    const exercise = block("moocfi/exercise", { id: "9f1c4a60-7d0e-4b9b-9a51-0c4b1c2f3d4e" })
    const result = await validate([block("moocfi/aside", {}, [exercise])], "course-page", {
      unchanged_client_ids: [exercise.clientId],
    })
    expect(result.errors.map((error) => [error.clientId, error.code])).toEqual([
      [exercise.clientId, "invalid_nesting"],
    ])
  })
})

describe("batches", () => {
  it("reports every error against its own block and keeps the rest", async () => {
    const good = paragraph("fine")
    const badMarkup = paragraph("<b>x</b>")
    const badName = block("core/aside")
    const result = await validate([good, badMarkup, badName])
    expect(result.errors).not.toEqual([])
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

  it("validates each page of a request on its own", async () => {
    const shared = paragraph("<b>x</b>")
    const response = await callBlockValidator({
      kind: "validate",
      body: {
        pages: [
          { page_type: "course-page", blocks: [shared] },
          { page_type: "course-page", blocks: [shared], unchanged_client_ids: [shared.clientId] },
        ],
        course_features: NO_COURSE_FEATURES,
      },
    })
    expect(response.status).toBe(200)
    const pages = (response.body as { pages: ValidationBody[] }).pages
    expect(pages.map((page) => [page.errors.length, page.warnings.length])).toEqual([
      [1, 0],
      [0, 1],
    ])
  })

  it("answers 400 to a malformed request", async () => {
    const course_features = NO_COURSE_FEATURES
    for (const body of [
      null,
      { page_type: "course-page", blocks: [], course_features },
      { pages: [{ blocks: [] }], course_features },
      { pages: [{ page_type: "exam", blocks: [] }], course_features },
      { pages: [{ page_type: "course-page" }], course_features },
      {
        pages: [{ page_type: "course-page", blocks: [], unchanged_client_ids: "all" }],
        course_features,
      },
      { pages: [{ exercise_context: "answer", blocks: [] }], course_features },
      { pages: [] },
      { pages: [], course_features: { ...course_features, chapter_locking_enabled: "yes" } },
    ]) {
      const response = await callBlockValidator({ kind: "validate", body })
      expect(response.status).toBe(400)
    }
  })
})
