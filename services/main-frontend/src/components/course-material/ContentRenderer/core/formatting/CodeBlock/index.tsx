"use client"

import { css } from "@emotion/css"
import { useMemo } from "react"

import { BlockRendererProps } from "../../.."

import { CopyButton } from "./CopyButton"
import { parseHighlightedCode } from "./highlightParser"
import { replaceBrTagsWithNewlines } from "./utils"

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
 */
const CodeBlock: React.FC<React.PropsWithChildren<BlockRendererProps<CodeAttributes>>> = ({
  data,
  dontAllowBlockToBeWiderThanContainerWidth,
}) => {
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

  return (
    <BreakFromCentered sidebar={false}>
      <div className={containerStyles}>
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
