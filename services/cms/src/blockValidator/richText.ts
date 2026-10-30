/* oxlint-disable i18next/no-literal-string */

import { SETTINGS_DEFAULTS } from "@wordpress/block-editor"
import { default as latexToMathML } from "@wordpress/latex-to-mathml"
import { concat, create, toHTMLString } from "@wordpress/rich-text"
import { escapeRegExp } from "lodash"

import { HEX_COLOR, type RichTextFormat } from "@/utils/Gutenberg/agentSchema"

import { CSS_CLASS_LIST } from "./attributeRefinements"

/** A rich-text problem an agent has to fix before the write is accepted. */
export interface MarkupProblem {
  message: string
  fix: string
}

const TRANSPARENT_BACKGROUND = "rgba(0, 0, 0, 0)"
const CSS_CLASS_LIST_PATTERN = new RegExp(CSS_CLASS_LIST)
const TEXT_COLOR_STYLE = new RegExp(
  `^background-color:(?:${escapeRegExp(TRANSPARENT_BACKGROUND)}|${HEX_COLOR})(?:;color:${HEX_COLOR})?$`,
)
const LANGUAGE_TAG = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/
/** Characters `create` drops silently. */
const RESERVED_CHARACTERS = /[\r﻿￼]/

const PALETTE_COLOR_CLASSES = new Set(
  (SETTINGS_DEFAULTS.colors ?? []).map(({ slug }: { slug: string }) => `has-${slug}-color`),
)

const LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"])

/** Whether a URL is one a link, image or embed may point to; relative URLs count. */
export const isSafeUrl = (url: string): boolean => {
  if (/[\s<>"]/.test(url)) {
    return false
  }
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(url)
  return scheme === null || LINK_PROTOCOLS.has(`${scheme[1]?.toLowerCase()}:`)
}

type ElementCheck = (element: Element) => MarkupProblem | null

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
  const problem = onlyAttributes(element, ["href", "target", "rel", "class"])
  if (problem) {
    return problem
  }
  const className = element.getAttribute("class")
  if (className !== null && !CSS_CLASS_LIST_PATTERN.test(className)) {
    return {
      message: `Link class ${JSON.stringify(className)} isn't a list of CSS class names.`,
      fix: "Remove the class, or give space-separated CSS class names.",
    }
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
      fix: `Use ${RICH_TEXT_FORMATS["core/text-color"].markup}. Palette colours: ${[...PALETTE_COLOR_CLASSES].join(", ")}.`,
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
        fix: RICH_TEXT_FORMATS["core/language"].markup,
      })

const checkMath = (element: Element): MarkupProblem | null =>
  onlyAttributes(element, ["data-latex"]) ??
  (element.getAttribute("data-latex")
    ? null
    : { message: "<math> without data-latex.", fix: RICH_TEXT_FORMATS["core/math"].markup })

interface FormatRule {
  /** The element the format stores. */
  tag: string
  check: ElementCheck
  /** The markup the format stores, as documented for agents in the schema export. */
  markup: string
}

/**
 * Formats a teacher can apply from the toolbar or with shortcuts. Inline images are left out on
 * purpose, and the non-breaking space is a character, not markup.
 */
export const RICH_TEXT_FORMATS = {
  "core/bold": { tag: "strong", check: withoutAttributes, markup: "<strong>text</strong>" },
  "core/italic": { tag: "em", check: withoutAttributes, markup: "<em>text</em>" },
  "core/link": {
    tag: "a",
    check: checkLink,
    markup:
      '<a href="https://example.com">text</a>; to open in a new tab add target="_blank" rel="noopener"; for nofollow rel="nofollow" (or "noopener nofollow" with target="_blank")',
  },
  "core/code": { tag: "code", check: withoutAttributes, markup: "<code>text</code>" },
  "core/strikethrough": { tag: "s", check: withoutAttributes, markup: "<s>text</s>" },
  "core/underline": {
    tag: "span",
    check: checkUnderline,
    markup: '<span style="text-decoration: underline;">text</span>',
  },
  "core/text-color": {
    tag: "mark",
    check: checkTextColor,
    markup:
      '<mark style="background-color:rgba(0, 0, 0, 0)" class="has-inline-color has-vivid-red-color">text</mark> with a palette colour, or <mark style="background-color:rgba(0, 0, 0, 0);color:#123456" class="has-inline-color">text</mark>; a highlight replaces rgba(0, 0, 0, 0) with a #rrggbb colour',
  },
  "core/subscript": { tag: "sub", check: withoutAttributes, markup: "<sub>text</sub>" },
  "core/superscript": { tag: "sup", check: withoutAttributes, markup: "<sup>text</sup>" },
  "core/keyboard": { tag: "kbd", check: withoutAttributes, markup: "<kbd>text</kbd>" },
  "core/language": {
    tag: "bdo",
    check: checkLanguage,
    markup: '<bdo lang="fi" dir="ltr">text</bdo>',
  },
  "core/math": {
    tag: "math",
    check: checkMath,
    markup:
      '<math data-latex="x^2"></math>; the MathML inside is generated from data-latex, so leave the element empty',
  },
} as const satisfies Record<RichTextFormat, FormatRule>

/** Every toolbar format, in the order the schema export lists them. */
export const TOOLBAR_FORMATS = Object.keys(RICH_TEXT_FORMATS) as readonly RichTextFormat[]

/** Formats in fields Gutenberg renders with `withoutInteractiveFormatting`. */
export const NON_INTERACTIVE_FORMATS: readonly RichTextFormat[] = TOOLBAR_FORMATS.filter(
  (format) => format !== "core/link",
)

interface ElementRule {
  format: RichTextFormat | null
  check: ElementCheck
}

// Maps, not objects: tag names come from the input, and `<constructor>` must not find Object.
const ELEMENT_RULES = new Map<string, ElementRule>([
  ["br", { format: null, check: withoutAttributes }],
  ...TOOLBAR_FORMATS.map((format): [string, ElementRule] => [
    RICH_TEXT_FORMATS[format].tag,
    { format, check: RICH_TEXT_FORMATS[format].check },
  ]),
])

const ELEMENT_ALTERNATIVES = new Map([
  ["b", "<strong>"],
  ["i", "<em>"],
  ["u", '<span style="text-decoration: underline;">'],
  ["del", "<s>"],
  ["strike", "<s>"],
  ["p", "separate blocks, or <br> for a line break"],
  ["div", "separate blocks, or <br> for a line break"],
])

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
    const rule = ELEMENT_RULES.get(tag)
    if (!rule) {
      const alternative = ELEMENT_ALTERNATIVES.get(tag)
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

let scratchBody: HTMLElement | undefined

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
  // One body for every value, as Gutenberg's create() keeps; a new document per value is slow.
  scratchBody ??= document.implementation.createHTMLDocument("").body
  scratchBody.innerHTML = html
  // Parsing turns a raw carriage return into a line feed but keeps an encoded one.
  if (RESERVED_CHARACTERS.test(html) || RESERVED_CHARACTERS.test(scratchBody.textContent ?? "")) {
    problems.push({
      message: "Contains a carriage return, U+FEFF or U+FFFC, which the editor drops.",
      fix: "Remove those characters, also as entities such as &#13;; write line breaks as <br>.",
    })
  }
  findMarkupProblems(scratchBody, allowedFormats, new Set(), problems)
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
