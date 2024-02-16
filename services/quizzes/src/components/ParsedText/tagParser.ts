import { HtmlRenderer, Parser as MarkdownParser } from "commonmark"
import KaTex from "katex"

const markdownParser = new MarkdownParser()
const htmlWriter = new HtmlRenderer()

const KATEX_OUTPUT_FORMAT = "htmlAndMathml"
const LATEX_REGEX = /\[latex\](.*?)\[\/latex\]/g
const MARKDOWN_REGEX = /\[markdown\](.*?)\[\/markdown\]/g
type PairArray<T, K> = [T, K][]

/**
 * Validate the text by checking if there are overlapping tags.
 * e.g. the following are invalid
 * '[latex][markdown][/latex][markdown]'
 * '[latex][markdown][/markdown][/latex]'
 * '[latex][latex][/latex][/latex]'
 *
 * @param text Text in the editor
 * @returns true if the text does not have overlapping tags
 */
const validateText = (latex = false, markdown = false, text: string) => {
  if ((latex && !markdown) || (!latex && markdown)) {
    return true
  }

  const latexLocations: PairArray<number, number> = []
  const markdownLocations: PairArray<number, number> = []

  let match
  while ((match = LATEX_REGEX.exec(text)) !== null) {
    latexLocations.push([match.index, LATEX_REGEX.lastIndex])
  }
  while ((match = MARKDOWN_REGEX.exec(text)) !== null) {
    markdownLocations.push([match.index, MARKDOWN_REGEX.lastIndex])
  }

  // Index in latex array
  let lindex = 0
  // Index in markdown array
  let mindex = 0
  const array: PairArray<number, number> = []

  while (lindex < latexLocations.length || mindex < markdownLocations.length) {
    if (lindex >= latexLocations.length) {
      array.push(markdownLocations[mindex])
      mindex++
      continue
    }

    if (mindex >= markdownLocations.length) {
      array.push(latexLocations[lindex])
      lindex++
      continue
    }

    if (latexLocations[lindex][0] < markdownLocations[mindex][0]) {
      array.push(latexLocations[lindex])
      lindex++
    } else {
      array.push(markdownLocations[mindex])
      mindex++
    }
  }

  for (let i = 0; i < array.length - 1; i++) {
    if (
      (array[i][0] < array[i + 1][0] && array[i + 1][0] < array[i][1]) ||
      (array[i][0] < array[i + 1][1] && array[i + 1][1] < array[i][1])
    ) {
      return false
    }
  }

  return true
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
    return res.replace(/<p>/, "").replace(/<\/p>/, "")
  }
  return res
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
 * Format text by replacing tags with their corresponding html
 *
 * @param latex If true, content inside latex tags will be converted to html
 * @param markdown If true, content inside markdown tags will be converted to html
 * @param text Text with tags that to be parsed
 * @returns Text, where tags are replaced with html
 */
const formatText = (latex = false, markdown = false, text: string | null, inline = false) => {
  let formattedText = text ?? ""
  if (latex) {
    formattedText = formattedText.replace(LATEX_REGEX, (_, latex) => parseLatex(latex, !inline))
  }

  if (markdown) {
    formattedText = formattedText.replace(MARKDOWN_REGEX, (_, markdown) => parseMarkdown(markdown))
  }

  return formattedText
}

export { isValidText, formatText }
