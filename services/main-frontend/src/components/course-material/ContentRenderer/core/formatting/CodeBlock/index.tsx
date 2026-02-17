"use client"

import { css } from "@emotion/css"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../../.."

import { CopyButton } from "./CopyButton"
import { parseHighlightedCode } from "./highlightParser"
import { formatHighlightedLinesRanges, replaceBrTagsWithNewlines } from "./utils"

import { CodeAttributes } from "@/../types/GutenbergBlockAttributes"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { monospaceFont } from "@/shared-module/common/styles"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const SyntaxHighlightedContainer = dynamicImport(() => import("./SyntaxHighlightedContainer"))

const containerStyles = css`
  position: relative;
  max-width: 1000px;
  margin: 0 auto;
`

const srOnlyStyles = css`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
`

const getPreStyles = (fontSizePx: number, allowFullWidth: boolean) => css`
  margin-top: 0;
  font-size: ${fontSizePx}px;
  font-family: ${monospaceFont} !important;
  line-height: 1.75rem;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  padding: 16px;
  ${allowFullWidth &&
  `
    margin-top: -1.5rem;
    margin-bottom: -1.5rem;
  `}
`

/**
 * Renders a code block with syntax highlighting and a copy button.
 * Adjusts font size based on the longest line of code.
 *
 * Input (e.g. from Gutenberg) may use `<br>` for line breaks. We normalize those to `\n` before
 * parsing and display. Escaped br (e.g. `&lt;br&gt;`) is left as literal text and is not treated as a newline.
 */
const CodeBlock: React.FC<React.PropsWithChildren<BlockRendererProps<CodeAttributes>>> = ({
  data,
  dontAllowBlockToBeWiderThanContainerWidth,
}) => {
  const { t } = useTranslation()
  const { content } = data.attributes

  const processedContent = useMemo(() => replaceBrTagsWithNewlines(content ?? undefined), [content])

  const { cleanCode, highlightedLines } = useMemo(
    () => parseHighlightedCode(processedContent),
    [processedContent],
  )

  const fontSizePx = useMemo(() => {
    const longestLine = cleanCode.split("\n").reduce((acc, line) => Math.max(acc, line.length), 0)
    const baseSize = longestLine > 100 ? 14 : longestLine > 70 ? 16 : 20
    if (dontAllowBlockToBeWiderThanContainerWidth) {
      return baseSize - 4
    }
    return baseSize
  }, [cleanCode, dontAllowBlockToBeWiderThanContainerWidth])

  const highlightedLinesSummary =
    highlightedLines && highlightedLines.size > 0
      ? formatHighlightedLinesRanges(highlightedLines)
      : ""

  return (
    <BreakFromCentered sidebar={false}>
      <div className={containerStyles}>
        {highlightedLinesSummary && (
          <span className={srOnlyStyles}>
            {t("code-block-highlighted-lines", { lines: highlightedLinesSummary })}
          </span>
        )}
        {cleanCode && <CopyButton content={cleanCode} />}
        <pre
          className={getPreStyles(fontSizePx, dontAllowBlockToBeWiderThanContainerWidth ?? false)}
        >
          <SyntaxHighlightedContainer content={cleanCode} highlightedLines={highlightedLines} />
        </pre>
      </div>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(CodeBlock)
