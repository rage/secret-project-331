import { HtmlRenderer, Parser as MarkdownParser } from "commonmark"
import KaTex from "katex"

const markdownParser = new MarkdownParser()
const htmlWriter = new HtmlRenderer()

const KATEX_OUTPUT_FORMAT = "htmlAndMathml"
const ANY_TAG_REGEX = /\[(latex|markdown)\]([\s\S]*?)\[\/\1\]/g

const escapeHtml = (input: string) => {
  const div = document.createElement("div")
  div.textContent = input
  return div.innerHTML
}

/**
 * Validate the text by ensuring there is no nesting or overlapping of tags.
 * Rules:
 * - Tags must not be nested at all
 * - Closing tags must match the last opened tag
 * - All opened tags must be closed
 */
const validateText = (latex = false, markdown = false, text: string) => {
  if (!latex && !markdown) {
    return true
  }

  const tokenRegex = /\[(\/)?(latex|markdown)\]/g
  const stack: string[] = []
  let match: RegExpExecArray | null
  while ((match = tokenRegex.exec(text)) !== null) {
    const isClosing = Boolean(match[1])
    const tagName = match[2]

    if (!isClosing) {
      if (stack.length > 0) {
        // Nested tag
        return false
      }
      stack.push(tagName)
    } else {
      if (stack.length === 0) {
        // Closing without open
        return false
      }
      const open = stack.pop()
      if (open !== tagName) {
        // Mismatched close
        return false
      }
    }
  }

  return stack.length === 0
}

/**
 * Convert latex to html
 *
 * @param text String in latex format
 * @returns LaTex in HTML
 */
const parseLatex = (text: string, displayMode: boolean) => {
  return KaTex.renderToString(text, {
    throwOnError: false,
    displayMode,
    output: KATEX_OUTPUT_FORMAT,
  })
}

/**
 * Conver markdown to html
 *
 * @param text String in markdown format
 * @returns Markdown in HTML
 */
const parseMarkdown = (text: string) => {
  const res = htmlWriter.render(markdownParser.parse(text))
  // This one is usually used with only one line of text and markdown wraps all text into paragraps. If this is the case, we'll remove wrapping paragrap tags so that the styling of the text is not messed up by the extra tag.
  const countOfParagraphTags = (res.match(/<p>/g) || []).length
  if (countOfParagraphTags === 1) {
    return res.replace(/<p>/, "").replace(/<\/p>/, "").trim()
  }

  return res.trim()
}

/**
 * Check if the text has overlapping tags
 *
 * @param latex If true, checks for latex tags
 * @param markdown If true, checks for markdown tags
 * @param text Text to be validated
 * @returns True if there are not overlapping tags
 */
const isValidText = (latex = false, markdown = false, text: string) => {
  return !((latex || markdown) && !validateText(latex, markdown, text))
}

/**
 * Format text by replacing tags with their corresponding html. Any content outside of tags is escaped so that it is not rendered as HTML.
 *
 * @param latex If true, content inside latex tags will be converted to html
 * @param markdown If true, content inside markdown tags will be converted to html
 * @param text Text with tags that to be parsed
 * @returns Text, where tags are replaced with html
 */
const formatText = (latex = false, markdown = false, text: string | null, inline = false) => {
  const originalText = text ?? ""

  // If tags are enabled but text is invalid (nested/overlapping), return escaped original
  if ((latex || markdown) && !validateText(latex, markdown, originalText)) {
    return escapeHtml(originalText)
  }

  // Build output ensuring that all content outside recognized tags is escaped.
  const parts: string[] = []
  let lastIndex = 0

  for (let match: RegExpExecArray | null; (match = ANY_TAG_REGEX.exec(originalText)) !== null; ) {
    const fullMatch = match[0]
    const tagName = match[1]
    const innerContent = match[2]
    const start = match.index
    const end = ANY_TAG_REGEX.lastIndex

    // Escape text before the tag
    if (start > lastIndex) {
      parts.push(escapeHtml(originalText.slice(lastIndex, start)))
    }

    // Render tag content if enabled, otherwise show the tag literally (escaped)
    if (tagName === "latex" && latex) {
      parts.push(parseLatex(innerContent, !inline))
    } else if (tagName === "markdown" && markdown) {
      parts.push(parseMarkdown(innerContent))
    } else {
      parts.push(escapeHtml(fullMatch))
    }

    lastIndex = end
  }

  // Escape any remaining text after the last tag
  if (lastIndex < originalText.length) {
    parts.push(escapeHtml(originalText.slice(lastIndex)))
  }

  return parts.join("")
}

export { isValidText, formatText }
