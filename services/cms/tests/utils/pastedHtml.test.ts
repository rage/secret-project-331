/**
 * @jest-environment jsdom
 */

import { TextEncoder } from "util"

import { getBlockType, pasteHandler, registerBlockType } from "@wordpress/blocks"
import { addFilter } from "@wordpress/hooks"

import type { BlockInstance } from "@/utils/Gutenberg/types"

import { coreBlocksToRegister } from "../../src/blocks/supportedGutenbergBlocks"
import { CODE_LANGUAGES } from "../../src/utils/Gutenberg/codeLanguages"
import { modifyCodeBlockAttributes } from "../../src/utils/Gutenberg/modifyBlockAttributes"
import { normalizePastedHtml } from "../../src/utils/Gutenberg/paste/normalizePastedHtml"
import {
  normalizePasteEvent,
  registerGutenbergMathStandIn,
} from "../../src/utils/Gutenberg/paste/normalizePasteEvent"
import {
  addPasteTransforms,
  CODE_LANGUAGE_ALIASES,
} from "../../src/utils/Gutenberg/paste/pasteTransforms"

// jsdom lacks TextEncoder, which block-library's dependencies use at import time.
globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder
const { __experimentalGetCoreBlocks } = await import("@wordpress/block-library")

const CORE_BLOCKS = [
  "core/paragraph",
  "core/heading",
  "core/code",
  "core/preformatted",
  "core/list",
  "core/list-item",
  "core/quote",
  "core/table",
  "core/image",
  "core/embed",
  "core/html",
]

/** Only the names and attributes matter to paste handling, so the course blocks are stand-ins. */
const COURSE_BLOCKS: Record<string, Record<string, { type: string }>> = {
  "moocfi/latex": { text: { type: "string" } },
  "moocfi/infobox": {},
  "moocfi/expandable-content": {},
  "moocfi/expandable-content-inner-block": { name: { type: "string" } },
}

beforeAll(() => {
  addFilter("blocks.registerBlockType", "test/modifyCodeAttributes", modifyCodeBlockAttributes)
  addFilter("blocks.registerBlockType", "test/pasteTransforms", addPasteTransforms)
  // oxlint-disable-next-line typescript/no-explicit-any
  __experimentalGetCoreBlocks().forEach((block: any) => {
    if (CORE_BLOCKS.includes(block.name) && !getBlockType(block.name)) {
      block.init()
    }
  })
  Object.entries(COURSE_BLOCKS).forEach(([name, attributes]) => {
    registerBlockType(name, { title: name, category: "text", attributes, save: () => null })
  })
  registerGutenbergMathStandIn()
})

interface PastedBlock {
  name: string
  attributes: Record<string, string>
  innerBlocks?: PastedBlock[]
}

/** Attributes paste handling decides; the rest are block defaults. */
const SUMMARIZED_ATTRIBUTES = ["content", "language", "text", "name", "level", "ordered", "href"]

const summarize = (blocks: BlockInstance[]): PastedBlock[] =>
  blocks.map((block) => ({
    name: block.name,
    attributes: Object.fromEntries(
      SUMMARIZED_ATTRIBUTES.filter((key) => {
        const value = block.attributes[key]
        return value !== undefined && value !== "" && value !== false
      }).map((key) => [key, String(block.attributes[key])]),
    ),
    ...(block.innerBlocks.length > 0 ? { innerBlocks: summarize(block.innerBlocks) } : {}),
  }))

const OPTIONS = { canInsertDisplayMath: true, isFromVsCode: false }

const paste = (html: string): PastedBlock[] => {
  const normalized = normalizePastedHtml(html, OPTIONS)
  return summarize(pasteHandler({ HTML: normalized, mode: "BLOCKS" }) as BlockInstance[])
}

const katex = (tex: string) =>
  `<span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mi>E</mi></mrow><annotation encoding="application/x-tex">${tex}</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="base"><span class="mord mathnormal">E</span></span></span></span>`

const pasteEvent = (plainText: string): ClipboardEvent => {
  const data: Record<string, string> = { "text/plain": plainText, "text/html": "" }
  const paragraph = document.createElement("p")
  paragraph.setAttribute("contenteditable", "true")
  return {
    target: paragraph,
    clipboardData: { getData: (format: string) => data[format] ?? "" },
  } as unknown as ClipboardEvent
}

describe("pasted code blocks", () => {
  it("keeps the language of GitHub's highlighted code", () => {
    expect(
      paste(
        `<div class="highlight highlight-source-python notranslate position-relative overflow-auto" dir="auto"><pre><span class="pl-k">def</span> <span class="pl-en">f</span>():
    <span class="pl-k">return</span> <span class="pl-c1">1</span> <span class="pl-c1">&lt;</span> <span class="pl-c1">2</span> &amp; 3</pre><div class="zeroclipboard-container"><clipboard-copy aria-label="Copy" class="ClipboardButton btn" value="x"><svg aria-hidden="true" height="16"><path d="M0 6.75"></path></svg></clipboard-copy></div></div>`,
      ),
    ).toEqual([
      {
        name: "core/code",
        attributes: { language: "python", content: "def f():\n    return 1 &lt; 2 &amp; 3" },
      },
    ])
  })

  it("keeps code without a language as code", () => {
    expect(
      paste(
        `<div class="snippet-clipboard-content notranslate position-relative overflow-auto"><pre class="notranslate"><code>x = 1
y = 2
</code></pre></div>`,
      ),
    ).toEqual([{ name: "core/code", attributes: { content: "x = 1\ny = 2" } }])
  })

  it("reads the language from Sphinx, Jupyter and Stack Overflow markup", () => {
    expect(
      paste(
        `<div class="highlight-python notranslate"><div class="highlight"><pre><span></span><span class="n">x</span> <span class="o">=</span> <span class="mi">1</span>
</pre></div></div><div class="highlight hl-ipython3"><pre><span class="n">y</span> <span class="o">=</span> <span class="mi">2</span></pre></div><pre class="lang-js s-code-block"><code class="hljs language-javascript"><span class="hljs-keyword">const</span> z = <span class="hljs-number">3</span></code></pre>`,
      ),
    ).toEqual([
      { name: "core/code", attributes: { language: "python", content: "x = 1" } },
      { name: "core/code", attributes: { language: "python", content: "y = 2" } },
      { name: "core/code", attributes: { language: "javascript", content: "const z = 3" } },
    ])
  })

  it("drops ChatGPT's header and copy button from the code", () => {
    expect(
      paste(
        `<pre class="overflow-visible!"><div class="contain-inline-size rounded-md"><div class="flex items-center text-token-text-secondary">python</div><div class="sticky top-9"><button class="flex gap-1 items-center">Copy code</button></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-python"><span class="hljs-keyword">def</span> f():
    <span class="hljs-keyword">return</span> <span class="hljs-number">1</span></code></div></div></pre>`,
      ),
    ).toEqual([
      { name: "core/code", attributes: { language: "python", content: "def f():\n    return 1" } },
    ])
  })

  it("keeps the indentation of code copied from VS Code", () => {
    const html = `<meta charset='utf-8'><div style="color: #cccccc;background-color: #1f1f1f;font-family: Menlo, Monaco, 'Courier New', monospace;font-weight: normal;font-size: 12px;line-height: 18px;white-space: pre;"><div><span style="color: #569cd6;">def</span><span style="color: #cccccc;"> </span><span style="color: #dcdcaa;">f</span><span style="color: #cccccc;">():</span></div><div><span style="color: #cccccc;">    </span><span style="color: #c586c0;">return</span><span style="color: #cccccc;"> </span><span style="color: #b5cea8;">1</span></div><br><div><span style="color: #dcdcaa;">f</span><span style="color: #cccccc;">()</span></div></div>`
    const normalized = normalizePastedHtml(html, {
      ...OPTIONS,
      isFromVsCode: true,
      vsCodeLanguage: "python",
    })
    expect(
      summarize(pasteHandler({ HTML: normalized, mode: "BLOCKS" }) as BlockInstance[]),
    ).toEqual([
      {
        name: "core/code",
        attributes: { language: "python", content: "def f():\n    return 1\n\nf()" },
      },
    ])
  })

  it("pastes a rendered Mermaid diagram as its source", () => {
    expect(
      paste(
        `<section data-identity="d9086b54" data-host="https://viewscreen.githubusercontent.com" data-src="https://viewscreen.githubusercontent.com/markdown/mermaid?docs_host=https%3A%2F%2Fdocs.github.com" data-type="mermaid" aria-label="mermaid rendered output container" class="js-render-box render-container"><div class="js-render-enrichment-target" data-plain="flowchart TD
    A[Start] --&gt; B
" dir="auto"><div class="render-plaintext-hidden"><details><summary role="button"><svg width="16" height="16"></svg></summary></details><clipboard-copy role="button" value="flowchart TD
    A[Start] --&gt; B
" tabindex="0"><svg height="16"></svg></clipboard-copy></div></div><span class="js-render-enrichment-loader"></span><iframe class="render-viewer" src="https://viewscreen.githubusercontent.com/markdown/mermaid?docs_host=https%3A%2F%2Fdocs.github.com" name="d9086b54" title="File display" role="presentation"></iframe></section>`,
      ),
    ).toEqual([
      { name: "core/code", attributes: { content: "flowchart TD\n    A[Start] --&gt; B" } },
    ])
  })

  it("keeps a notebook cell's output next to its code", () => {
    expect(
      paste(
        `<div class="cell"><div class="cell_input"><div class="highlight-ipython3 notranslate"><div class="highlight"><pre><span class="n">plt</span><span class="o">.</span><span class="n">plot</span>(x)</pre></div></div></div><div class="cell_output"><img src="https://example.com/plot.png" alt="Plot"></div></div>`,
      ).map((block) => block.name),
    ).toEqual(["core/code", "core/image"])
  })

  it("leaves pre-wrap text from other apps alone", () => {
    const html = `<div style="white-space: pre-wrap;"><div>Heading</div><div><b>bold</b> text</div></div>`
    expect(normalizePastedHtml(html, { ...OPTIONS, isFromVsCode: true })).toBe(html)
  })

  it("leaves blocks copied inside the editor alone", () => {
    const html = `<!-- wp:code --><pre class="wp-block-code"><code>x = 1</code></pre><!-- /wp:code -->`
    expect(normalizePastedHtml(html, OPTIONS)).toBe(html)
  })

  it("still pastes a plain pre as preformatted text", () => {
    expect(paste(`<pre>poem\n  indented</pre>`)).toEqual([
      { name: "core/preformatted", attributes: { content: "poem\n  indented" } },
    ])
  })

  it("maps every alias to a language the picker offers", () => {
    const pickerLanguages = new Set(CODE_LANGUAGES.map((language) => language.value))
    expect(
      Object.values(CODE_LANGUAGE_ALIASES).filter((language) => !pickerLanguages.has(language)),
    ).toEqual([])
  })
})

describe("pasted math", () => {
  it("turns inline formulas into [latex] markup", () => {
    expect(paste(`<p>Energy ${katex("E=mc^2")} is conserved.</p>`)).toEqual([
      {
        name: "core/paragraph",
        attributes: { content: "Energy [latex]E=mc^2[/latex] is conserved." },
      },
    ])
  })

  it("reads MathJax 3's TeX", () => {
    expect(
      paste(
        `<span>When<span> </span></span><mjx-container class="MathJax" jax="CHTML"><mjx-math data-latex="a \\ne 0" class="MJX-TEX"><mjx-mi data-latex="a"><mjx-c>𝑎</mjx-c></mjx-mi><mjx-mo data-latex="\\ne"><mjx-c>≠</mjx-c></mjx-mo><mjx-mn data-latex="0"><mjx-c>0</mjx-c></mjx-mn></mjx-math></mjx-container><span>, then</span><mjx-container class="MathJax" jax="CHTML" display="true"><mjx-math data-latex="x = 1" display="true" class="MJX-TEX"><mjx-mi><mjx-c>𝑥</mjx-c></mjx-mi></mjx-math></mjx-container>`,
      ),
    ).toEqual([
      { name: "core/paragraph", attributes: { content: "When [latex]a \\ne 0[/latex], then" } },
      { name: "moocfi/latex", attributes: { text: "x = 1" } },
    ])
  })

  it("keeps formulas without TeX as MathML", () => {
    const mathMl = `<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>E</mi><mo>=</mo><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup></math>`
    const github = `<p dir="auto">Einstein's famous equation:&nbsp;<math-renderer class="js-inline-math" style="display: inline" data-static-url="https://github.githubassets.com/static" data-run-id="abc">${mathMl}</math-renderer></p>`
    const katexWithoutTex = `<p>Einstein's famous equation:&nbsp;<span class="katex"><span class="katex-mathml">${mathMl}</span><span class="katex-html" aria-hidden="true"><span class="base"><span class="mord mathnormal">E</span><span class="mrel">=</span></span></span></span></p>`
    const mathJax2 = `<p>Einstein's famous equation:&nbsp;<span class="MathJax_Preview" style="color: inherit;"></span><span class="MathJax" id="MathJax-Element-1-Frame" tabindex="0" data-mathml="${mathMl.replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}" role="presentation"><nobr aria-hidden="true"><span class="math" id="MathJax-Span-1">E=mc2</span></nobr></span></p>`
    for (const html of [github, katexWithoutTex, mathJax2]) {
      expect(paste(html)).toEqual([
        {
          name: "core/paragraph",
          attributes: { content: `Einstein's famous equation:&nbsp;${mathMl}` },
        },
      ])
    }
  })

  it("turns display formulas into LaTeX blocks", () => {
    expect(
      paste(
        `<p>Before</p><p><span class="katex-display">${katex("\\sum_{i=1}^n i")}</span></p><p>After</p>`,
      ),
    ).toEqual([
      { name: "core/paragraph", attributes: { content: "Before" } },
      { name: "moocfi/latex", attributes: { text: "\\sum_{i=1}^n i" } },
      { name: "core/paragraph", attributes: { content: "After" } },
    ])
  })
})

describe("pasted display math outside a paragraph", () => {
  const displayFormula = `<span class="katex-display"><span class="katex"><span class="katex-mathml"><math><semantics><mrow><mi>x</mi></mrow><annotation encoding="application/x-tex">x^2</annotation></semantics></math></span></span></span>`

  it("keeps the table cell it sits in", () => {
    expect(
      normalizePastedHtml(
        `<table><tbody><tr><td>${displayFormula}</td></tr></tbody></table>`,
        OPTIONS,
      ),
    ).toContain('<td><div data-pasted-latex="x^2">[latex]x^2[/latex]</div></td>')
  })

  it("survives an inline paste", () => {
    expect(
      pasteHandler({
        HTML: normalizePastedHtml(`<p>${displayFormula}</p>`, OPTIONS),
        mode: "INLINE",
      }),
    ).toBe("[latex]x^2[/latex]")
  })
})

describe("pasted plain-text TeX", () => {
  it("becomes a LaTeX block instead of being dropped", () => {
    const event = pasteEvent("\\frac{a}{b} + x^2")
    normalizePasteEvent(event)
    const html = event.clipboardData?.getData("text/html") ?? ""
    expect(summarize(pasteHandler({ HTML: html, mode: "AUTO" }) as BlockInstance[])).toEqual([
      { name: "moocfi/latex", attributes: { text: "\\frac{a}{b} + x^2" } },
    ])
  })

  it("needs Gutenberg's own math block to stay unregistered", () => {
    // Registering it would skip the stand-in and paste blocks the course material cannot show.
    expect(coreBlocksToRegister).not.toContain("core/math")
  })

  it("leaves ordinary text alone", () => {
    const event = pasteEvent("Just a sentence with x^2 in it.")
    normalizePasteEvent(event)
    expect(event.clipboardData?.getData("text/html")).toBe("")
  })
})

describe("pasted GitHub Markdown", () => {
  it("drops heading permalinks", () => {
    expect(
      paste(
        `<div class="markdown-heading" dir="auto"><h2 tabindex="-1" class="heading-element" dir="auto">My Section</h2><a id="user-content-my-section" class="anchor" aria-label="Permalink: My Section" href="#my-section"><svg class="octicon octicon-link" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="m7.775 3.275"></path></svg></a></div><p dir="auto">Text</p>`,
      ),
    ).toEqual([
      { name: "core/heading", attributes: { level: "2", content: "My Section" } },
      { name: "core/paragraph", attributes: { content: "Text" } },
    ])
  })

  it("keeps table column alignment", () => {
    const [table] = paste(
      `<table><thead><tr><th align="left">A</th><th align="center">B</th><th align="right">C</th></tr></thead><tbody><tr><td align="left">1</td><td align="center">2</td><td align="right">3</td></tr></tbody></table>`,
    )
    expect(table?.name).toBe("core/table")
    const pasted = pasteHandler({
      HTML: normalizePastedHtml(
        `<table><thead><tr><th align="center">B</th></tr></thead><tbody><tr><td align="right">2</td></tr></tbody></table>`,
        OPTIONS,
      ),
      mode: "BLOCKS",
    }) as BlockInstance[]
    expect(pasted[0]?.attributes.head[0].cells[0].align).toBe("center")
    expect(pasted[0]?.attributes.body[0].cells[0].align).toBe("right")
  })

  it("turns alerts into info boxes", () => {
    expect(
      paste(
        `<div class="markdown-alert markdown-alert-note" dir="auto"><p class="markdown-alert-title" dir="auto"><svg class="octicon octicon-info mr-2" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M0 8a8"></path></svg>Note</p><p dir="auto">Useful information.</p></div>`,
      ),
    ).toEqual([
      {
        name: "moocfi/infobox",
        attributes: {},
        innerBlocks: [
          { name: "core/paragraph", attributes: { content: "<strong>Note</strong>" } },
          { name: "core/paragraph", attributes: { content: "Useful information." } },
        ],
      },
    ])
  })

  it("turns details into expandable content", () => {
    expect(
      paste(`<details><summary>Show answer</summary><p dir="auto">The answer is 42.</p></details>`),
    ).toEqual([
      {
        name: "moocfi/expandable-content",
        attributes: {},
        innerBlocks: [
          {
            name: "moocfi/expandable-content-inner-block",
            attributes: { name: "Show answer" },
            innerBlocks: [{ name: "core/paragraph", attributes: { content: "The answer is 42." } }],
          },
        ],
      },
    ])
  })

  it("drops footnote links and keeps task list state", () => {
    expect(
      paste(
        `<p dir="auto">Claim<sup><a href="#user-content-fn-1-abc" id="user-content-fnref-1-abc" data-footnote-ref="" aria-describedby="footnote-label">1</a></sup>.</p><ul class="contains-task-list"><li class="task-list-item"><input type="checkbox" id="" disabled="" class="task-list-item-checkbox" checked=""> Done</li><li class="task-list-item"><input type="checkbox" id="" disabled="" class="task-list-item-checkbox"> Todo</li></ul><section data-footnotes="" class="footnotes"><ol dir="auto"><li id="user-content-fn-1-abc"><p dir="auto">Source. <a href="#user-content-fnref-1-abc" data-footnote-backref="" aria-label="Back to reference 1" class="data-footnote-backref">↩</a></p></li></ol></section>`,
      ),
    ).toEqual([
      { name: "core/paragraph", attributes: { content: "Claim<sup>1</sup>." } },
      {
        name: "core/list",
        attributes: {},
        innerBlocks: [
          { name: "core/list-item", attributes: { content: "☑ Done" } },
          { name: "core/list-item", attributes: { content: "☐ Todo" } },
        ],
      },
      {
        name: "core/list",
        attributes: { ordered: "true" },
        innerBlocks: [{ name: "core/list-item", attributes: { content: "Source." } }],
      },
    ])
  })

  it("keeps the paragraphs and code of a loose list item on separate lines", () => {
    expect(
      paste(
        `<ul><li><p>First</p><p>More</p></li><li>Run:<div class="highlight highlight-source-shell"><pre>pip install foo
pip list</pre></div></li></ul>`,
      ),
    ).toEqual([
      {
        name: "core/list",
        attributes: {},
        innerBlocks: [
          { name: "core/list-item", attributes: { content: "First<br>More" } },
          {
            name: "core/list-item",
            attributes: {
              content: "Run:<br><code>pip install foo</code><br><code>pip list</code>",
            },
          },
        ],
      },
    ])
  })

  it("does not link images to themselves", () => {
    expect(
      paste(
        `<p dir="auto"><a target="_blank" rel="noopener noreferrer" href="https://github.com/o/r/blob/main/cat.png"><img src="https://github.com/o/r/raw/main/cat.png" alt="Cat" style="max-width: 100%;"></a></p>`,
      )[0]?.attributes.href,
    ).toBeUndefined()
  })
})

describe("pasted Google Docs", () => {
  it("unwraps redirect links and marks monospace text as code", () => {
    expect(
      paste(
        `<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-abc"><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;"><a href="https://www.google.com/url?q=https://example.com/page&amp;sa=D&amp;source=editors&amp;ust=1&amp;usg=x" style="text-decoration:none;"><span style="font-size:11pt;font-family:Arial,sans-serif;color:#1155cc;text-decoration:underline;">link</span></a><span style="font-size:11pt;font-family:Arial,sans-serif;"> and </span><span style="font-size:11pt;font-family:'Courier New',monospace;">print()</span></p></b>`,
      ),
    ).toEqual([
      {
        name: "core/paragraph",
        attributes: {
          content: '<a href="https://example.com/page">link</a> and <code>print()</code>',
        },
      },
    ])
  })

  it("keeps the alignment Google Docs sets on cell paragraphs", () => {
    const pasted = pasteHandler({
      HTML: normalizePastedHtml(
        `<table><tbody><tr><td style="border-left:solid #000 1pt;"><p dir="ltr" style="line-height:1.2;text-align: center;margin-top:0pt;"><span style="font-size:11pt;">x</span></p></td></tr></tbody></table>`,
        OPTIONS,
      ),
      mode: "BLOCKS",
    }) as BlockInstance[]
    expect(pasted[0]?.attributes.body[0].cells[0].align).toBe("center")
  })
})

describe("pasted HTML that needs no rewriting", () => {
  it("is returned unchanged", () => {
    const html = `<meta charset="utf-8"><p>Plain <strong>text</strong></p>`
    expect(normalizePastedHtml(html, OPTIONS)).toBe(html)
  })
})
