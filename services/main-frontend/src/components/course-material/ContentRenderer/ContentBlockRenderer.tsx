"use client"

import { css, cx } from "@emotion/css"

import { useBlockIntersectionObserver } from "@/shared-module/common/hooks/useBlockIntersectionObserver"
import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import type { Block } from "@/types/courseMaterialBlock"
import {
  COURSE_MATERIAL_DEFAULT_BLOCK_MARGIN_REM,
  courseMaterialBlockClass,
} from "@/utils/course-material/constants"

import { blockToRendererMap } from "."
import DefaultBlock from "./DefaultBlock"

interface ContentBlockRendererProps {
  block: Block<unknown>
  isExam: boolean
  dontAllowBlockToBeWiderThanContainerWidth: boolean
  blockRendererOverrides: Record<string, unknown>
  highlightBlocks: string[]
}

const highlightedBlockStyles = css`
  outline: 2px solid ${baseTheme.colors.red[400]};
  outline-offset: 10px;
`

// Adds a default margin between all blocks. If you would like to undo this margin in some cases, add a negative margin to the block implementation
// or add dontUseDefaultBlockMargin to the block implementation. See the Heading block for an example.
const defaultBlockMargin = css`
  margin: ${COURSE_MATERIAL_DEFAULT_BLOCK_MARGIN_REM}rem 0;
`

const ContentBlockRenderer: React.FC<ContentBlockRendererProps> = ({
  block,
  isExam,
  dontAllowBlockToBeWiderThanContainerWidth,
  blockRendererOverrides,
  highlightBlocks,
}) => {
  const ref = useBlockIntersectionObserver()

  const Component =
    blockRendererOverrides[block.name] ?? blockToRendererMap[block.name] ?? DefaultBlock

  const isHighlighted = highlightBlocks.includes(block.clientId)
  const dontUseDefaultBlockMargin = Component.dontUseDefaultBlockMargin === true

  const wrapperClassName = cx(
    courseMaterialBlockClass,
    (isHighlighted && highlightedBlockStyles) ?? undefined,
    dontUseDefaultBlockMargin ? undefined : defaultBlockMargin,
  )

  if (Component.dontRenderWrapperDivIllDoItMySelf === true) {
    return (
      <Component
        id={block.clientId}
        data={block}
        isExam={isExam}
        wrapperClassName={wrapperClassName}
        dontAllowBlockToBeWiderThanContainerWidth={dontAllowBlockToBeWiderThanContainerWidth}
      />
    )
  }

  return (
    <div ref={ref} id={block.clientId} className={wrapperClassName} data-block-name={block.name}>
      <Component
        id={block.clientId}
        data={block}
        isExam={isExam}
        wrapperClassName={wrapperClassName}
        dontAllowBlockToBeWiderThanContainerWidth={dontAllowBlockToBeWiderThanContainerWidth}
      />
    </div>
  )
}

export default withErrorBoundary(ContentBlockRenderer)
