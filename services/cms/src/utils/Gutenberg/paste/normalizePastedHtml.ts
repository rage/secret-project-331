/** Marks a display formula for the moocfi/latex paste transform; the value is the TeX source. */
export const DISPLAY_LATEX_ATTRIBUTE = "data-pasted-latex"

interface PastedHtmlNormalizationOptions {
  /** False when the editor has no moocfi/latex block, so display math stays inline. */
  canInsertDisplayMath: boolean
  /** Whether the clipboard carries VS Code's own format next to the HTML. */
  isFromVsCode: boolean
  /** Language of a code snippet copied from VS Code, which only tells it outside the HTML. */
  vsCodeLanguage?: string | undefined
}

const CODE_LANGUAGE_CLASS_PATTERNS = [
  /^language-(.+)$/,
  /^lang-(.+)$/,
  /^highlight-(?:source|text)-(.+)$/,
  /^highlight-(.+)$/,
  /^hl-(.+)$/,
]

const HEADING_ANCHOR_TEXTS = new Set(["", "¶", "#", "§", "🔗"])

const MONOSPACE_FONT = /courier|consolas|monaco|menlo|mono\b|monospace/i

const MEDIA_SELECTOR = "img, picture, video, audio, canvas, iframe, object, table"

/** Rendered formats that keep a formula's TeX and/or MathML alongside the rendering. */
const FORMULA_FORMATS = [
  {
    selector: ".katex-display, .katex",
    getTex: (formula: Element) =>
      formula.querySelector('annotation[encoding="application/x-tex"]')?.textContent,
    mathMlSelector: "math",
    isDisplay: (formula: Element) => formula.classList.contains("katex-display"),
  },
  {
    // MathJax 3 keeps the TeX of the whole formula on its outermost mjx-math.
    selector: "mjx-container",
    getTex: (formula: Element) =>
      formula.querySelector("mjx-math[data-latex]")?.getAttribute("data-latex"),
    mathMlSelector: "mjx-assistive-mml > math",
    isDisplay: (formula: Element) => formula.getAttribute("display") === "true",
  },
]

/**
 * Rewrites clipboard HTML from common sources (GitHub, GitLab, Sphinx, Jupyter, VS Code, ChatGPT,
 * Google Docs, Word) into the plain structures Gutenberg's paste handling understands.
 *
 * Returns the input unchanged when nothing needed rewriting, so pastes from other sources keep
 * Gutenberg's exact behaviour. The paste transforms in `pasteTransforms.ts` consume what this emits.
 */
export function normalizePastedHtml(html: string, options: PastedHtmlNormalizationOptions): string {
  // Blocks copied inside the editor; Gutenberg parses and validates their markup as is.
  if (html.includes("<!-- wp:")) {
    return html
  }
  const doc = new DOMParser().parseFromString(html, "text/html")
  const originalBody = doc.body.innerHTML
  if (options.isFromVsCode) {
    convertVsCodeSnippet(doc, options.vsCodeLanguage)
  }
  convertMermaidDiagrams(doc)
  normalizeCodeBlocks(doc)
  convertMath(doc, options.canInsertDisplayMath)
  removeHeadingAnchors(doc)
  simplifyGitHubMarkup(doc)
  alignTableCells(doc)
  flattenListItemBlocks(doc)
  unwrapGoogleRedirectLinks(doc)
  unwrapSelfLinkedImages(doc)
  markMonospaceSpansAsCode(doc)
  // Windows clipboard markers sit in the body as comments, so they survive for Gutenberg to strip.
  const normalizedBody = doc.body.innerHTML
  return normalizedBody === originalBody ? html : normalizedBody
}

/**
 * Pasteable HTML for a formula: a moocfi/latex placeholder for display math, else the inline
 * `[latex]` markup paragraphs render. The placeholder's text is that markup too, so a paste that
 * falls back to inline content (e.g. into a list item) still keeps the formula.
 */
export function createLatexElement(
  doc: Document,
  tex: string,
  isDisplay: boolean,
): HTMLElement | Text {
  // The renderer's [latex] pattern does not span lines.
  const inlineLatex = doc.createTextNode(`[latex]${tex.replaceAll(/\s*\n\s*/g, " ")}[/latex]`)
  if (!isDisplay) {
    return inlineLatex
  }
  const latex = doc.createElement("div")
  latex.setAttribute(DISPLAY_LATEX_ATTRIBUTE, tex)
  latex.append(inlineLatex)
  return latex
}

function createCodeBlock(doc: Document, code: string, language: string | null): HTMLPreElement {
  const pre = doc.createElement("pre")
  const codeElement = doc.createElement("code")
  if (language) {
    codeElement.className = `language-${language}`
  }
  codeElement.textContent = code.replace(/\n+$/, "")
  pre.append(codeElement)
  return pre
}

/** VS Code copies one `<div>` per line inside a `white-space: pre` container instead of a `<pre>`. */
function convertVsCodeSnippet(doc: Document, language: string | undefined): void {
  const container = doc.body.querySelector<HTMLElement>(":scope > div")
  if (
    !container ||
    !/white-space:\s*pre\s*(?:;|$)/.test(container.getAttribute("style") ?? "") ||
    !Array.from(container.children).every(
      (line) => line.nodeName === "DIV" || line.nodeName === "BR",
    )
  ) {
    return
  }
  const lines = Array.from(container.children).map((line) =>
    line.nodeName === "BR" ? "" : (line.textContent ?? ""),
  )
  container.replaceWith(createCodeBlock(doc, lines.join("\n"), language ?? null))
}

/** Language named by `code`, or by `pre` and its wrappers up to and including `wrapper`. */
function findCodeLanguage(code: Element | null, pre: Element, wrapper: Element): string | null {
  const candidates = code ? [code] : []
  for (let element: Element | null = pre; element; element = element.parentElement) {
    candidates.push(element)
    if (element === wrapper) {
      break
    }
  }
  for (const element of candidates) {
    // Elsewhere `lang` is the human language of the text.
    const lang =
      (element.nodeName === "PRE" ? element.getAttribute("lang") : null) ??
      element.getAttribute("data-lang")
    if (lang) {
      return lang
    }
    for (const className of Array.from(element.classList)) {
      for (const pattern of CODE_LANGUAGE_CLASS_PATTERNS) {
        const match = pattern.exec(className)
        if (match?.[1]) {
          return match[1]
        }
      }
    }
  }
  return null
}

/** Copy buttons and other controls around code: no text, no media. */
const isCodeBlockChrome = (node: Node): boolean =>
  node.nodeType === Node.TEXT_NODE
    ? (node.textContent?.trim() ?? "") === ""
    : node.nodeType !== Node.ELEMENT_NODE ||
      ((node.textContent?.trim() ?? "") === "" &&
        !(node as Element).matches(MEDIA_SELECTOR) &&
        (node as Element).querySelector(MEDIA_SELECTOR) === null)

/** Outermost wrapper around `pre` that adds nothing but controls such as copy buttons. */
function findCodeBlockWrapper(pre: Element): Element {
  let wrapper = pre
  for (
    let parent = wrapper.parentElement;
    parent &&
    parent !== wrapper.ownerDocument.body &&
    (parent.nodeName === "DIV" || parent.nodeName === "SECTION") &&
    Array.from(parent.childNodes).every((child) => child === wrapper || isCodeBlockChrome(child));
    parent = wrapper.parentElement
  ) {
    wrapper = parent
  }
  return wrapper
}

/** GitHub copies a rendered Mermaid diagram as an iframe, keeping the source only in attributes. */
function convertMermaidDiagrams(doc: Document): void {
  doc.body.querySelectorAll('section[data-type="mermaid"]').forEach((diagram) => {
    const source = diagram.querySelector("[data-plain]")?.getAttribute("data-plain") ?? ""
    diagram.replaceWith(createCodeBlock(doc, source, "mermaid"))
  })
}

/**
 * Gives every code block the `<pre><code class="language-…">` shape. Highlighters often drop the
 * `<code>` (GitHub, Sphinx, Jupyter) or add headers inside the `<pre>` (ChatGPT), which Gutenberg
 * would paste as preformatted text.
 */
function normalizeCodeBlocks(doc: Document): void {
  const pres = Array.from(doc.body.querySelectorAll("pre")).filter(
    (pre) => !pre.parentElement?.closest("pre"),
  )
  for (const pre of pres) {
    const codeElements = pre.querySelectorAll("code")
    const code = codeElements.length === 1 ? (codeElements[0] ?? null) : null
    const wrapper = findCodeBlockWrapper(pre)
    const language = findCodeLanguage(code, pre, wrapper)
    // A bare <pre> of text is preformatted prose, e.g. a poem.
    if (!code && !language && !pre.querySelector("span")) {
      continue
    }
    wrapper.replaceWith(createCodeBlock(doc, (code ?? pre).textContent ?? "", language))
  }
}

/** Topmost elements matching `selector`, skipping matches nested inside another match. */
const outermost = (doc: Document, selector: string): Element[] =>
  Array.from(doc.body.querySelectorAll(selector)).filter(
    (element) => !element.parentElement?.closest(selector),
  )

/**
 * Turns rendered formulas back into TeX where the clipboard carries it: inline ones into the
 * `[latex]` markup paragraphs render, display ones into a moocfi/latex block. Without TeX, the
 * formula is reduced to its MathML, which paragraphs render natively (GitHub's math is MathML only).
 */
function convertMath(doc: Document, canInsertDisplayMath: boolean): void {
  for (const format of FORMULA_FORMATS) {
    for (const formula of outermost(doc, format.selector)) {
      const tex = format.getTex(formula)?.trim()
      const mathMl = formula.querySelector(format.mathMlSelector)
      if (!tex) {
        if (mathMl) {
          formula.replaceWith(mathMl)
        }
        continue
      }
      const isDisplay = format.isDisplay(formula) && canInsertDisplayMath
      const paragraph = formula.parentElement
      const isAloneInParagraph =
        isDisplay &&
        (paragraph?.nodeName === "P" || paragraph?.nodeName === "DIV") &&
        (paragraph.textContent?.trim() ?? "") === (formula.textContent?.trim() ?? "")
      ;(isAloneInParagraph && paragraph ? paragraph : formula).replaceWith(
        createLatexElement(doc, tex, isDisplay),
      )
    }
  }

  // MathJax 2 renders into spans and keeps the formula only as serialized MathML.
  doc.body
    .querySelectorAll(".MathJax_Preview, script[type^='math/']")
    .forEach((preview) => preview.remove())
  const parser = new DOMParser()
  for (const formula of outermost(doc, "[data-mathml]")) {
    const mathMl = parser
      .parseFromString(formula.getAttribute("data-mathml") ?? "", "text/html")
      .body.querySelector("math")
    if (mathMl) {
      formula.replaceWith(doc.importNode(mathMl, true))
    }
  }
}

/** Permalink icons next to headings (GitHub, Sphinx, Jupyter) paste as empty or "¶" links. */
function removeHeadingAnchors(doc: Document): void {
  doc.body.querySelectorAll("a[href]").forEach((anchor) => {
    if (
      (anchor.getAttribute("href") ?? "").includes("#") &&
      anchor.querySelector("img") === null &&
      HEADING_ANCHOR_TEXTS.has(anchor.textContent?.trim() ?? "") &&
      (anchor.closest("h1, h2, h3, h4, h5, h6") !== null ||
        anchor.parentElement?.querySelector(
          ":scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6",
        ) !== null)
    ) {
      anchor.remove()
    }
  })
}

/** Footnote links point at anchors that do not exist after pasting; task list boxes are inputs. */
function simplifyGitHubMarkup(doc: Document): void {
  doc.body
    .querySelectorAll("a[data-footnote-ref]")
    .forEach((link) => link.replaceWith(...Array.from(link.childNodes)))
  doc.body.querySelectorAll("a[data-footnote-backref]").forEach((link) => link.remove())
  doc.body
    .querySelectorAll('input[type="checkbox"]')
    .forEach((checkbox) =>
      checkbox.replaceWith(doc.createTextNode(checkbox.hasAttribute("checked") ? "☑ " : "☐ ")),
    )
  doc.body.querySelectorAll(".markdown-alert-title").forEach((title) => {
    const strong = doc.createElement("strong")
    strong.textContent = title.textContent?.trim() ?? ""
    const paragraph = doc.createElement("p")
    paragraph.append(strong)
    title.replaceWith(paragraph)
  })
}

/**
 * Gutenberg reads a cell's alignment only from its inline style, but Markdown renderers use the
 * `align` attribute and Google Docs aligns the paragraphs inside the cell.
 */
function alignTableCells(doc: Document): void {
  doc.body.querySelectorAll<HTMLTableCellElement>("td, th").forEach((cell) => {
    if (cell.style.textAlign) {
      return
    }
    const paragraphAlignments = new Set(
      Array.from(cell.querySelectorAll<HTMLElement>(":scope > p")).map((p) => p.style.textAlign),
    )
    const alignment =
      cell.getAttribute("align") ??
      (paragraphAlignments.size === 1 ? Array.from(paragraphAlignments)[0] : null)
    if (alignment && alignment !== "left" && alignment !== "start") {
      cell.style.textAlign = alignment
    }
  })
}

/**
 * List items only hold inline content, so Gutenberg runs a loose item's paragraphs and code blocks
 * together; keep them on separate lines instead.
 */
function flattenListItemBlocks(doc: Document): void {
  doc.body.querySelectorAll("li").forEach((item) => {
    Array.from(item.children).forEach((child) => {
      if (child.nodeName !== "P" && child.nodeName !== "PRE") {
        return
      }
      const replacement: Node[] = []
      if (child.previousSibling && (child.previousSibling.textContent?.trim() ?? "") !== "") {
        replacement.push(doc.createElement("br"))
      }
      if (child.nodeName === "PRE") {
        ;(child.textContent ?? "").split("\n").forEach((line, index) => {
          if (index > 0) {
            replacement.push(doc.createElement("br"))
          }
          const code = doc.createElement("code")
          code.textContent = line
          replacement.push(code)
        })
      } else {
        replacement.push(...Array.from(child.childNodes))
      }
      child.replaceWith(...replacement)
    })
  })
}

/** Google Docs routes every link through a google.com/url redirect. */
function unwrapGoogleRedirectLinks(doc: Document): void {
  doc.body
    .querySelectorAll<HTMLAnchorElement>('a[href^="https://www.google.com/url?"]')
    .forEach((link) => {
      const target = new URL(link.href).searchParams.get("q")
      if (target && /^https?:\/\//.test(target)) {
        link.setAttribute("href", target)
      }
    })
}

/** GitHub links every image to its own file, which would make the pasted image a link. */
function unwrapSelfLinkedImages(doc: Document): void {
  doc.body.querySelectorAll("a[href]").forEach((link) => {
    const image = link.querySelector(":scope > img")
    if (!image || link.children.length !== 1 || (link.textContent?.trim() ?? "") !== "") {
      return
    }
    const href = (link.getAttribute("href") ?? "").replace("/blob/", "/raw/")
    const sources = [image.getAttribute("src"), image.getAttribute("data-canonical-src")]
    if (sources.some((source) => source && source.replace("/blob/", "/raw/") === href)) {
      link.replaceWith(image)
    }
  })
}

/** Google Docs and Word mark inline code only with a monospace font. */
function markMonospaceSpansAsCode(doc: Document): void {
  doc.body.querySelectorAll<HTMLElement>("span[style]").forEach((span) => {
    if (!MONOSPACE_FONT.test(span.style.fontFamily) || span.closest("pre, code")) {
      return
    }
    const code = doc.createElement("code")
    code.append(...Array.from(span.childNodes))
    span.append(code)
  })
}
