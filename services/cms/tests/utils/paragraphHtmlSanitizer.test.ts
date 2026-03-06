/**
 * @jest-environment jsdom
 */

import {
  collectParagraphHtmlTagNames,
  sanitizeParagraphHtml,
} from "../../src/utils/Gutenberg/paragraphHtmlSanitizer"

describe("sanitizeParagraphHtml", () => {
  it("preserves simple inline markup", () => {
    const result = sanitizeParagraphHtml("Hello <strong>world</strong>")
    expect(result).toBe("Hello <strong>world</strong>")
  })

  it("strips outer paragraph wrapper", () => {
    const result = sanitizeParagraphHtml("<p>Hello <em>world</em></p>")
    expect(result).toBe("Hello <em>world</em>")
  })

  it("drops unsupported block-level tags but preserves inner text", () => {
    const result = sanitizeParagraphHtml("<div><h1>Title</h1></div>")
    expect(result).toBe("Title")
  })

  it("strips span attributes", () => {
    const result = sanitizeParagraphHtml('<span class="x">Text</span>')
    expect(result).toBe("<span>Text</span>")
  })

  it("preserves Gutenberg inline color and highlight markup", () => {
    const result = sanitizeParagraphHtml(
      'A <mark class="has-inline-color has-vivid-red-color" style="background-color:rgba(0, 0, 0, 0);color:#cf2e2e">test</mark>',
    )

    expect(result).toContain("<mark")
    expect(result).toContain('class="has-inline-color has-vivid-red-color"')
    expect(result).toContain("background-color:rgba(0, 0, 0, 0)")
    expect(result).toContain("color:#cf2e2e")
    expect(result).toContain(">test</mark>")
  })

  it("preserves safe Gutenberg span formatting and drops unsupported classes and styles", () => {
    const result = sanitizeParagraphHtml(
      '<span class="has-inline-color has-large-font-size custom-class" style="color:#08a5e9;font-size:1.25rem;text-decoration: underline;position:absolute">Text</span>',
    )

    expect(result).toContain("<span")
    expect(result).toContain('class="has-inline-color has-large-font-size"')
    expect(result).toContain("color:#08a5e9")
    expect(result).toContain("font-size:1.25rem")
    expect(result).toContain("text-decoration:underline")
    expect(result).not.toContain("custom-class")
    expect(result).not.toContain("position:absolute")
    expect(result).toContain(">Text</span>")
  })

  it("strips unsafe link attributes", () => {
    const result = sanitizeParagraphHtml(
      '<a href="http://example.com" onclick="alert(1)" data-foo="bar">x</a>',
    )
    expect(result).toContain("<a")
    expect(result).toContain(">x</a>")
    expect(result).not.toContain("onclick")
    expect(result).not.toContain("data-foo")
  })

  it("removes HTML comments", () => {
    const result = sanitizeParagraphHtml("<!-- wp:paragraph --><p>Text</p>")
    expect(result).toBe("Text")
  })

  it("preserves multiple allowed inline tags together", () => {
    const result = sanitizeParagraphHtml(
      "Hello <strong>world</strong> <em>and</em> <code>x</code><kbd>Esc</kbd><s>old</s><sub>1</sub><sup>2</sup>",
    )
    expect(result).toBe(
      "Hello <strong>world</strong> <em>and</em> <code>x</code><kbd>Esc</kbd><s>old</s><sub>1</sub><sup>2</sup>",
    )
  })

  it("drops script tag and its contents entirely", () => {
    const result = sanitizeParagraphHtml('Safe<script>alert("xss")</script>Text')
    expect(result).toBe("SafeText")
    expect(result).not.toContain("script")
    expect(result).not.toContain("alert")
  })

  it("drops iframe subtree", () => {
    const result = sanitizeParagraphHtml(
      'Before<iframe src="https://example.com"><p>Inside</p></iframe>After',
    )
    expect(result).toBe("BeforeAfter")
    expect(result).not.toContain("iframe")
  })

  it("sanitizes javascript href URLs on links", () => {
    const result = sanitizeParagraphHtml('<a href="javascript:alert(1)">Click</a>')
    expect(result).toContain("Click")
    expect(result).not.toContain("javascript:")
  })

  it("sanitizes data URLs on links", () => {
    const result = sanitizeParagraphHtml(
      '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Click</a>',
    )
    expect(result).toContain("Click")
    expect(result).not.toContain("data:")
  })

  it("removes event handler attributes from non-link inline tags", () => {
    const result = sanitizeParagraphHtml('<strong onclick="alert(1)">Bold</strong>')
    expect(result).toBe("<strong>Bold</strong>")
    expect(result).not.toContain("onclick")
  })

  it("handles malformed markup by relying on browser repair plus sanitization", () => {
    const result = sanitizeParagraphHtml("<strong>Unclosed")
    expect(result).toContain("<strong>")
    expect(result).toContain("Unclosed")
  })

  it("preserves literal angle brackets in plain-text suggestions", () => {
    const result = sanitizeParagraphHtml("Vec<T> and use <div> tags")
    expect(result).toBe("Vec&lt;T&gt; and use &lt;div&gt; tags")
  })

  it("preserves literal angle brackets alongside inline markup", () => {
    const result = sanitizeParagraphHtml("Use <div> tags and <em>emphasis</em>")
    expect(result).toBe("Use &lt;div&gt; tags and <em>emphasis</em>")
  })

  it("preserves paragraph separators when flattening block elements", () => {
    const result = sanitizeParagraphHtml("<p>One</p><p>Two</p>")
    expect(result).toBe("One<br><br>Two")
  })

  it("preserves list item separators when flattening list markup", () => {
    const result = sanitizeParagraphHtml("<ul><li>One</li><li>Two</li></ul>")
    expect(result).toBe("- One<br>- Two")
  })

  it("escapes literal html examples that were not present in the original paragraph html", () => {
    const allowedTagNames = collectParagraphHtmlTagNames(
      'See <a href="/docs">docs</a> and &lt;em&gt;text&lt;/em&gt;',
    )

    const result = sanitizeParagraphHtml('See <a href="/docs">docs</a> and <em>text</em>', {
      allowedTagNames,
    })

    expect(result).toBe('See <a href="/docs">docs</a> and &lt;em&gt;text&lt;/em&gt;')
  })

  it("allows root wrappers while escaping new html in plain-text suggestions", () => {
    const allowedTagNames = collectParagraphHtmlTagNames("Plain paragraph")

    expect(sanitizeParagraphHtml("<p>Plain paragraph</p>", { allowedTagNames })).toBe(
      "Plain paragraph",
    )
    expect(sanitizeParagraphHtml("Use <div></div>", { allowedTagNames })).toBe(
      "Use &lt;div&gt;&lt;/div&gt;",
    )
  })
})
