/* oxlint-disable i18next/no-literal-string */

import { SETTINGS_DEFAULTS } from "@wordpress/block-editor"
import { default as latexToMathML } from "@wordpress/latex-to-mathml"
import { concat, create, toHTMLString } from "@wordpress/rich-text"

/** A rich-text problem an agent has to fix before the write is accepted. */
export interface MarkupProblem {
  message: string
  fix: string
}

export type RichTextFormat =
  | "core/bold"
  | "core/italic"
  | "core/link"
  | "core/code"
  | "core/strikethrough"
  | "core/underline"
  | "core/text-color"
  | "core/subscript"
  | "core/superscript"
  | "core/keyboard"
  | "core/language"
  | "core/math"

/**
 * Formats a teacher can apply from the toolbar or with shortcuts. Inline images are left out on
 * purpose, and the non-breaking space is a character, not markup.
 */
export const TOOLBAR_FORMATS: readonly RichTextFormat[] = [
  "core/bold",
  "core/italic",
  "core/link",
  "core/code",
  "core/strikethrough",
  "core/underline",
  "core/text-color",
  "core/subscript",
  "core/superscript",
  "core/keyboard",
  "core/language",
  "core/math",
]

/** Formats in fields Gutenberg renders with `withoutInteractiveFormatting`. */
export const NON_INTERACTIVE_FORMATS: readonly RichTextFormat[] = TOOLBAR_FORMATS.filter(
  (format) => format !== "core/link",
)

/** The markup each format stores, as documented for agents in the schema export. */
export const RICH_TEXT_FORMAT_MARKUP: Record<RichTextFormat, string> = {
  "core/bold": "<strong>text</strong>",
  "core/italic": "<em>text</em>",
  "core/link":
    '<a href="https://example.com">text</a>; to open in a new tab add target="_blank" rel="noopener"; for nofollow rel="nofollow" (or "noopener nofollow" with target="_blank")',
  "core/code": "<code>text</code>",
  "core/strikethrough": "<s>text</s>",
  "core/underline": '<span style="text-decoration: underline;">text</span>',
  "core/text-color":
    '<mark style="background-color:rgba(0, 0, 0, 0)" class="has-inline-color has-vivid-red-color">text</mark> with a palette colour, or <mark style="background-color:rgba(0, 0, 0, 0);color:#123456" class="has-inline-color">text</mark>; a highlight replaces rgba(0, 0, 0, 0) with a #rrggbb colour',
  "core/subscript": "<sub>text</sub>",
  "core/superscript": "<sup>text</sup>",
  "core/keyboard": "<kbd>text</kbd>",
  "core/language": '<bdo lang="fi" dir="ltr">text</bdo>',
  "core/math":
    '<math data-latex="x^2"></math>; the MathML inside is generated from data-latex, so leave the element empty',
}

const TRANSPARENT_BACKGROUND = "rgba(0, 0, 0, 0)"
const HEX_COLOR = "#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})"
const TEXT_COLOR_STYLE = new RegExp(
  `^background-color:(?:${escapeRegExp(TRANSPARENT_BACKGROUND)}|${HEX_COLOR})(?:;color:${HEX_COLOR})?$`,
)
const LANGUAGE_TAG = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/
/** Characters `create` drops silently. */
const RESERVED_CHARACTERS = /[\r﻿￼]/

const PALETTE_COLOR_CLASSES = new Set(
  (SETTINGS_DEFAULTS.colors ?? []).map(({ slug }: { slug: string }) => `has-${slug}-color`),
)

function escapeRegExp(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"])

/** Whether a URL is one a link, image or embed may point to; relative URLs count. */
export const isSafeUrl = (url: string): boolean => {
  const trimmed = url.trim()
  if (trimmed !== url || /[\s<>"]/.test(url)) {
    return false
  }
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(url)
  return scheme === null || LINK_PROTOCOLS.has(`${scheme[1]?.toLowerCase()}:`)
}

interface ElementRule {
  format: RichTextFormat | null
  check: (element: Element) => MarkupProblem | null
}

const attributeNames = (element: Element): string[] =>
  Array.from(element.attributes, (attribute) => attribute.name)

const onlyAttributes = (element: Element, allowed: string[]): MarkupProblem | null => {
  const extra = attributeNames(element).filter((name) => !allowed.includes(name))
  if (extra.length === 0) {
    return null
  }
  const tag = element.tagName.toLowerCase()
  return {
    message: `<${tag}> has attributes the editor never writes: ${extra.join(", ")}.`,
    fix:
      allowed.length === 0
        ? `Write <${tag}> without attributes.`
        : `Keep only ${allowed.join(", ")} on <${tag}>.`,
  }
}

const withoutAttributes = (element: Element) => onlyAttributes(element, [])

const checkLink = (element: Element): MarkupProblem | null => {
  const problem = onlyAttributes(element, ["href", "target", "rel"])
  if (problem) {
    return problem
  }
  const href = element.getAttribute("href")
  if (href === null || href === "" || !isSafeUrl(href)) {
    return {
      message: `Link target ${JSON.stringify(href)} isn't an http(s), mailto, tel or relative URL.`,
      fix: 'Give the link an href such as "https://example.com" or "/path".',
    }
  }
  const target = element.getAttribute("target")
  const rel = element.getAttribute("rel")
  const validRel =
    target === "_blank"
      ? rel === "noopener" || rel === "noopener nofollow"
      : target === null && (rel === null || rel === "nofollow")
  if (!validRel) {
    return {
      message: `Link target=${JSON.stringify(target)} rel=${JSON.stringify(rel)} isn't a combination the link editor writes.`,
      fix: 'Use no target and no rel, rel="nofollow", target="_blank" rel="noopener", or target="_blank" rel="noopener nofollow".',
    }
  }
  return null
}

const checkUnderline = (element: Element): MarkupProblem | null =>
  onlyAttributes(element, ["style"]) ??
  (element.getAttribute("style") === "text-decoration: underline;"
    ? null
    : {
        message: "A <span> is only valid as underline.",
        fix: 'Write underline as <span style="text-decoration: underline;">, or remove the <span>.',
      })

const checkTextColor = (element: Element): MarkupProblem | null => {
  const problem = onlyAttributes(element, ["style", "class"])
  if (problem) {
    return problem
  }
  const classes = (element.getAttribute("class") ?? "").split(" ")
  const style = element.getAttribute("style") ?? ""
  const paletteClasses = classes.filter((name) => PALETTE_COLOR_CLASSES.has(name))
  const otherClasses = classes.filter(
    (name) => name !== "has-inline-color" && !PALETTE_COLOR_CLASSES.has(name),
  )
  const hasStyleColor = style.includes(";color:")
  if (
    classes[0] !== "has-inline-color" ||
    otherClasses.length > 0 ||
    paletteClasses.length > 1 ||
    (paletteClasses.length === 1 && hasStyleColor) ||
    !TEXT_COLOR_STYLE.test(style)
  ) {
    return {
      message: `<mark> with class=${JSON.stringify(element.getAttribute("class"))} style=${JSON.stringify(style)} isn't text colour markup the editor writes.`,
      fix: `Use ${RICH_TEXT_FORMAT_MARKUP["core/text-color"]}. Palette colours: ${[...PALETTE_COLOR_CLASSES].join(", ")}.`,
    }
  }
  return null
}

const checkLanguage = (element: Element): MarkupProblem | null =>
  onlyAttributes(element, ["lang", "dir"]) ??
  (LANGUAGE_TAG.test(element.getAttribute("lang") ?? "") &&
  ["ltr", "rtl"].includes(element.getAttribute("dir") ?? "")
    ? null
    : {
        message: "<bdo> needs a language tag in lang and dir set to ltr or rtl.",
        fix: RICH_TEXT_FORMAT_MARKUP["core/language"],
      })

const checkMath = (element: Element): MarkupProblem | null =>
  onlyAttributes(element, ["data-latex"]) ??
  (element.getAttribute("data-latex")
    ? null
    : { message: "<math> without data-latex.", fix: RICH_TEXT_FORMAT_MARKUP["core/math"] })

const ELEMENT_RULES: Record<string, ElementRule> = {
  br: { format: null, check: withoutAttributes },
  strong: { format: "core/bold", check: withoutAttributes },
  em: { format: "core/italic", check: withoutAttributes },
  a: { format: "core/link", check: checkLink },
  code: { format: "core/code", check: withoutAttributes },
  s: { format: "core/strikethrough", check: withoutAttributes },
  span: { format: "core/underline", check: checkUnderline },
  mark: { format: "core/text-color", check: checkTextColor },
  sub: { format: "core/subscript", check: withoutAttributes },
  sup: { format: "core/superscript", check: withoutAttributes },
  kbd: { format: "core/keyboard", check: withoutAttributes },
  bdo: { format: "core/language", check: checkLanguage },
  math: { format: "core/math", check: checkMath },
}

const ELEMENT_ALTERNATIVES: Record<string, string> = {
  b: "<strong>",
  i: "<em>",
  u: '<span style="text-decoration: underline;">',
  del: "<s>",
  strike: "<s>",
  p: "separate blocks, or <br> for a line break",
  div: "separate blocks, or <br> for a line break",
}

const findMarkupProblems = (
  parent: Node,
  allowedFormats: ReadonlySet<RichTextFormat>,
  activeFormats: ReadonlySet<RichTextFormat>,
  problems: MarkupProblem[],
): void => {
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === node.TEXT_NODE) {
      continue
    }
    if (node.nodeType === node.COMMENT_NODE) {
      problems.push({ message: "HTML comments aren't allowed.", fix: "Remove the comment." })
      continue
    }
    if (node.nodeType !== node.ELEMENT_NODE) {
      problems.push({ message: "Unexpected markup.", fix: "Write text and inline formats only." })
      continue
    }
    const element = node as Element
    const tag = element.tagName.toLowerCase()
    const rule = ELEMENT_RULES[tag]
    if (!rule) {
      const alternative = ELEMENT_ALTERNATIVES[tag]
      problems.push({
        message: `<${tag}> isn't markup the editor writes.`,
        fix: alternative
          ? `Use ${alternative} instead of <${tag}>.`
          : `Remove <${tag}> and keep its text, or use one of the allowed formats.`,
      })
      continue
    }
    const problem = rule.check(element)
    if (problem) {
      problems.push(problem)
      continue
    }
    if (rule.format !== null && !allowedFormats.has(rule.format)) {
      problems.push({
        message: `${rule.format} (<${tag}>) isn't available in this field.`,
        fix: `Remove <${tag}> and keep its text.`,
      })
      continue
    }
    if (rule.format !== null && activeFormats.has(rule.format)) {
      problems.push({
        message: `<${tag}> is nested inside another <${tag}>.`,
        fix: `Remove the inner <${tag}>.`,
      })
      continue
    }
    if (rule.format === "core/math") {
      continue
    }
    findMarkupProblems(
      element,
      allowedFormats,
      rule.format === null ? activeFormats : new Set([...activeFormats, rule.format]),
      problems,
    )
  }
}

interface RichTextReplacement {
  type: string
  attributes?: Record<string, string>
  innerHTML?: string
}

export type RichTextResult =
  | { isValid: true; html: string }
  | { isValid: false; problems: MarkupProblem[] }

/**
 * Validates rich text against what a teacher can produce in the editor and returns the form the
 * editor stores. The canonical form is `toHTMLString(concat(create(html)))` with math MathML
 * regenerated from its LaTeX, as the math format does.
 */
export const normaliseRichText = (
  html: string,
  allowedFormats: ReadonlySet<RichTextFormat>,
): RichTextResult => {
  const problems: MarkupProblem[] = []
  if (RESERVED_CHARACTERS.test(html)) {
    problems.push({
      message: "Contains a carriage return, U+FEFF or U+FFFC, which the editor drops.",
      fix: "Remove those characters; write line breaks as <br>.",
    })
  }
  const parsed = document.implementation.createHTMLDocument("")
  parsed.body.innerHTML = html
  findMarkupProblems(parsed.body, allowedFormats, new Set(), problems)
  if (problems.length > 0) {
    return { isValid: false, problems }
  }

  const value = create({ html })
  const replacements = value.replacements as (RichTextReplacement | undefined)[]
  for (const [index, replacement] of replacements.entries()) {
    if (!replacement) {
      continue
    }
    if (replacement.type !== "core/math") {
      return {
        isValid: false,
        problems: [{ message: "Contains an empty element.", fix: "Remove empty elements." }],
      }
    }
    const latex = replacement.attributes?.["data-latex"] ?? ""
    try {
      replacements[index] = {
        ...replacement,
        innerHTML: latexToMathML(latex, { displayMode: false }),
      }
    } catch (error) {
      problems.push({
        message: `LaTeX ${JSON.stringify(latex)} doesn't parse: ${error instanceof Error ? error.message : String(error)}`,
        fix: "Correct the LaTeX in data-latex.",
      })
    }
  }
  if (problems.length > 0) {
    return { isValid: false, problems }
  }
  return { isValid: true, html: toHTMLString({ value: concat(value) }) }
}
