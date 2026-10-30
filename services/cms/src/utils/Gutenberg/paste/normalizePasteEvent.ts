import { getBlockType, pasteHandler, registerBlockType } from "@wordpress/blocks"

import type { BlockInstance } from "@/utils/Gutenberg/types"

import { createLatexElement, normalizePastedHtml } from "./normalizePastedHtml"

/** The block Gutenberg pastes plain-text TeX as. */
const GUTENBERG_MATH_BLOCK = "core/math"

/** Extra clipboard format VS Code writes; its `mode` is the language of the copied code. */
const VS_CODE_CLIPBOARD_FORMAT = "vscode-editor-data"

function readVsCodeLanguage(vsCodeData: string): string | undefined {
  try {
    const mode: unknown = JSON.parse(vsCodeData).mode
    return typeof mode === "string" ? mode : undefined
  } catch {
    return undefined
  }
}

/**
 * Registers a never-inserted stand-in for Gutenberg's math block. Without a registered block type
 * Gutenberg silently drops plain-text TeX pastes; with it, `normalizePasteEvent` can see Gutenberg
 * classify a paste as TeX and redirect it to moocfi/latex.
 */
export function registerGutenbergMathStandIn(): void {
  if (getBlockType(GUTENBERG_MATH_BLOCK)) {
    return
  }
  registerBlockType(GUTENBERG_MATH_BLOCK, {
    title: "Math",
    category: "text",
    attributes: { latex: { type: "string" } },
    supports: { inserter: false },
    save: () => null,
  })
}

/** TeX source when Gutenberg would paste the text as a math block, using its own heuristic. */
function getPlainTextLatex(plainText: string): string | null {
  // In INLINE mode only TeX comes back as blocks.
  const pasted = pasteHandler({ HTML: "", plainText, mode: "INLINE" }) as string | BlockInstance[]
  const [block] = Array.isArray(pasted) ? pasted : []
  return block?.name === GUTENBERG_MATH_BLOCK ? String(block.attributes.latex ?? "") : null
}

function latexHtml(tex: string, canInsertDisplayMath: boolean): string {
  const paragraph = document.createElement("p")
  paragraph.append(createLatexElement(document, tex, canInsertDisplayMath))
  return canInsertDisplayMath ? paragraph.innerHTML : paragraph.outerHTML
}

/** Blocks and fields that paste text verbatim, where TeX needs no rescue. */
const PLAIN_TEXT_PASTE_TARGETS =
  '[data-type="core/code"], [data-type="core/preformatted"], [data-type="core/html"]'

const isRichTextTarget = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  target.closest('[contenteditable="true"]') !== null &&
  target.closest(PLAIN_TEXT_PASTE_TARGETS) === null

/**
 * Hands Gutenberg's paste handling normalized clipboard HTML (see `normalizePastedHtml`), and
 * plain-text TeX as a LaTeX block. Must run before Gutenberg's own paste listeners, i.e. in the
 * capture phase on an ancestor of the editor.
 */
export function normalizePasteEvent(event: ClipboardEvent): void {
  const clipboardData = event.clipboardData
  if (!clipboardData) {
    return
  }
  const html = clipboardData.getData("text/html")
  const plainText = clipboardData.getData("text/plain")
  const canInsertDisplayMath = getBlockType("moocfi/latex") !== undefined
  let normalizedHtml = html
  if (html) {
    const vsCodeData = clipboardData.getData(VS_CODE_CLIPBOARD_FORMAT)
    normalizedHtml = normalizePastedHtml(html, {
      canInsertDisplayMath,
      isFromVsCode: vsCodeData !== "",
      vsCodeLanguage: readVsCodeLanguage(vsCodeData),
    })
  } else if (plainText && isRichTextTarget(event.target) && getBlockType(GUTENBERG_MATH_BLOCK)) {
    const tex = getPlainTextLatex(plainText)
    if (tex !== null) {
      normalizedHtml = latexHtml(tex, canInsertDisplayMath)
    }
  }
  if (normalizedHtml === html) {
    return
  }
  // Paste data is read-only and Gutenberg exposes no hook before parsing it, so shadow the reader.
  const getData = clipboardData.getData.bind(clipboardData)
  Object.defineProperty(clipboardData, "getData", {
    configurable: true,
    value: (format: string) => (format === "text/html" ? normalizedHtml : getData(format)),
  })
}
