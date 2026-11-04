import { createBlock, getBlockAttributes } from "@wordpress/blocks"

import { omitUndefined } from "@/shared-module/common/utils/nullability"
import type { BlockInstance } from "@/utils/Gutenberg/types"

import { CODE_LANGUAGES } from "../codeLanguages"
import { DISPLAY_LATEX_ATTRIBUTE } from "./normalizePastedHtml"

/**
 * Language names used by highlighters, Markdown fences and VS Code → values of the code language
 * picker, which also map to themselves.
 */
export const CODE_LANGUAGE_ALIASES: Record<string, string> = {
  ...Object.fromEntries(CODE_LANGUAGES.map(({ value }) => [value, value])),
  text: "plaintext",
  txt: "plaintext",
  sh: "bash",
  shell: "bash",
  shellscript: "bash",
  zsh: "bash",
  console: "bash",
  "shell-session": "bash",
  "c++": "cpp",
  cxx: "cpp",
  cs: "csharp",
  "c#": "csharp",
  golang: "go",
  html: "xml",
  "html-basic": "xml",
  js: "javascript",
  jsx: "javascript",
  javascriptreact: "javascript",
  jsonc: "json",
  "html-php": "php",
  py: "python",
  python3: "python",
  py3: "python",
  ipython: "python",
  ipython3: "python",
  pycon: "python",
  rb: "ruby",
  rs: "rust",
  ts: "typescript",
  tsx: "typescript",
  typescriptreact: "typescript",
  yml: "yaml",
}

const CODE_LANGUAGE_CLASS = /^language-(.+)$/

const isDisplayLatex = (node: Node): node is HTMLElement =>
  node.nodeName === "DIV" && (node as Element).hasAttribute(DISPLAY_LATEX_ATTRIBUTE)

// Chromium copies an empty shell of the block after a selection, so require content.
const hasText = (node: Node) => (node.textContent?.trim() ?? "") !== ""

const isMarkdownAlert = (node: Node): node is HTMLElement =>
  node.nodeName === "DIV" && (node as Element).classList.contains("markdown-alert") && hasText(node)

const isCodeBlock = (node: Node): node is HTMLElement =>
  node.nodeName === "PRE" &&
  (node as Element).children.length === 1 &&
  (node as Element).firstElementChild?.nodeName === "CODE"

type PasteHandler = (args: { HTML: string; mode: "BLOCKS" }) => BlockInstance[]

const PASTE_TRANSFORMS: Record<string, object> = {
  "core/code": {
    // Ahead of core/code's own transform, which drops the language.
    priority: 9,
    isMatch: isCodeBlock,
    schema: {
      pre: {
        children: { code: { classes: [CODE_LANGUAGE_CLASS], children: { "#text": {} } } },
      },
    },
    transform: (node: HTMLElement) => {
      const languageClass = Array.from(node.firstElementChild?.classList ?? [])
        .map((className) => CODE_LANGUAGE_CLASS.exec(className)?.[1])
        .find(Boolean)
      const language = languageClass
        ? CODE_LANGUAGE_ALIASES[languageClass.toLowerCase()]
        : undefined
      return createBlock(
        "core/code",
        omitUndefined({ ...getBlockAttributes("core/code", node.outerHTML), language }),
      )
    },
  },
  "moocfi/latex": {
    isMatch: isDisplayLatex,
    // Gutenberg merges a missing `children` with the alert div's "*" into { 0: "*" }, emptying alerts.
    schema: { div: { attributes: [DISPLAY_LATEX_ATTRIBUTE], children: "*" } },
    transform: (node: HTMLElement) =>
      createBlock("moocfi/latex", { text: node.getAttribute(DISPLAY_LATEX_ATTRIBUTE) ?? "" }),
  },
  "moocfi/infobox": {
    isMatch: isMarkdownAlert,
    schema: { div: { classes: [/^markdown-alert/], children: "*" } },
    transform: (node: HTMLElement, handler: PasteHandler) => {
      // htmlToBlocks copies the matched node's class onto the block's className.
      node.removeAttribute("class")
      return createBlock("moocfi/infobox", {}, handler({ HTML: node.innerHTML, mode: "BLOCKS" }))
    },
  },
  "moocfi/expandable-content": {
    isMatch: (node: Node) => node.nodeName === "DETAILS" && hasText(node),
    schema: { details: { children: "*" } },
    transform: (node: HTMLElement, handler: PasteHandler) => {
      const summary = node.querySelector(":scope > summary")
      const title = summary?.textContent?.trim() ?? ""
      summary?.remove()
      return createBlock("moocfi/expandable-content", {}, [
        createBlock(
          "moocfi/expandable-content-inner-block",
          { name: title },
          handler({ HTML: node.innerHTML, mode: "BLOCKS" }),
        ),
      ])
    },
  },
}

/**
 * Raw (paste) transforms for the HTML `normalizePastedHtml` emits: code blocks keep their language,
 * display math becomes a LaTeX block, GitHub alerts become info boxes and `<details>` becomes
 * expandable content.
 */
// oxlint-disable-next-line typescript/no-explicit-any
export function addPasteTransforms(settings: any, name: string): any {
  const transform = PASTE_TRANSFORMS[name]
  if (!transform) {
    return settings
  }
  return {
    ...settings,
    transforms: {
      ...settings.transforms,
      from: [...(settings.transforms?.from ?? []), { type: "raw", ...transform }],
    },
  }
}
