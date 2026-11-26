"use client"

import { css } from "@emotion/css"
import { useMemo, useState } from "react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import type { CodeAttributes } from "@/../types/GutenbergBlockAttributes"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import { omitUndefined } from "@/shared-module/common/utils/nullability"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { type ScrollOverflow, ScrollRegion } from "@/shared-module/components"

import type { BlockRendererProps } from "../../.."
import { CopyButton } from "./CopyButton"
import { parseHighlightedCode } from "./highlightParser"
import { getPreStyles, scrollerStyles, scrollHintStyles } from "./styles"
import { formatHighlightedLinesRanges, replaceBrTagsWithNewlines } from "./utils"

const SyntaxHighlightedContainer = dynamicImport(() => import("./SyntaxHighlightedContainer"))

const wideContainerStyles = css`
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 16px;
`

/** Holds the copy button in the code's top corner. */
const frameStyles = css`
  position: relative;
`

const NORMAL_FONT_SIZE_PX = 16
const FONT_SIZES_PX: Record<string, number> = { small: 14, normal: NORMAL_FONT_SIZE_PX, large: 18 }

/**
 * Renders a code block with syntax highlighting and a copy button, as wide as the text unless the
 * author chose a wide block.
 *
 * Input (e.g. from Gutenberg) may use `<br>` for line breaks. We normalize those to `\n` before
 * parsing and display. Escaped br (e.g. `&lt;br&gt;`) is left as literal text and is not treated as a newline.
 */
const CodeBlock: React.FC<React.PropsWithChildren<BlockRendererProps<CodeAttributes>>> = ({
  data,
  dontAllowBlockToBeWiderThanContainerWidth,
}) => {
  const { t } = useTranslation()
  // These are added to core/code by a CMS block filter and aren't part of the generated CodeAttributes type.
  const { content, language, codeWidth, codeFontSize } = data.attributes as CodeAttributes & {
    language?: string
    codeWidth?: string
    codeFontSize?: string
  }
  const isWide = codeWidth === "wide" && !dontAllowBlockToBeWiderThanContainerWidth
  const [overflow, setOverflow] = useState<ScrollOverflow>({ start: false, end: false })
  const fontSizePx = (codeFontSize && FONT_SIZES_PX[codeFontSize]) || NORMAL_FONT_SIZE_PX

  const processedContent = useMemo(() => replaceBrTagsWithNewlines(content ?? undefined), [content])

  const { cleanCode, highlightedLines } = useMemo(
    () => parseHighlightedCode(processedContent),
    [processedContent],
  )

  const highlightedLinesSummary =
    highlightedLines && highlightedLines.size > 0
      ? formatHighlightedLinesRanges(highlightedLines)
      : ""

  const code = (
    <div className={frameStyles}>
      {highlightedLinesSummary && (
        <VisuallyHidden>
          {t("code-block-highlighted-lines", { lines: highlightedLinesSummary })}
        </VisuallyHidden>
      )}
      {cleanCode && <CopyButton content={cleanCode} />}
      <ScrollRegion
        className={scrollerStyles}
        label={t("code-example")}
        onOverflowChange={setOverflow}
      >
        <pre className={getPreStyles(fontSizePx)}>
          <SyntaxHighlightedContainer
            content={cleanCode}
            highlightedLines={highlightedLines}
            {...omitUndefined({ language })}
          />
        </pre>
      </ScrollRegion>
      {overflow.end && <div aria-hidden className={scrollHintStyles} />}
    </div>
  )

  if (!isWide) {
    return code
  }
  return (
    <BreakFromCentered sidebar={false}>
      <div className={wideContainerStyles}>{code}</div>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(CodeBlock)
