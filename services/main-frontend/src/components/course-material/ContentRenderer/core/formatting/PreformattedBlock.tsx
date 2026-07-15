"use client"

import { css } from "@emotion/css"

import type { PreformattedAttributes } from "@/../types/GutenbergBlockAttributes"
import { monospaceFont } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { fontSizeMapper } from "@/styles/course-material/fontSizeMapper"
import { sanitizeCourseMaterialHtml } from "@/utils/course-material/sanitizeCourseMaterialHtml"

import type { BlockRendererProps } from "../.."

const PreformattedBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<PreformattedAttributes>>
> = ({ data }) => {
  const { content, fontSize } = data.attributes
  return (
    <pre
      className={css`
        ${fontSize && `font-size: ${fontSizeMapper(fontSize)};`}
        white-space: pre-wrap;
        font-family: ${monospaceFont};
        overflow-wrap: break-word;
      `}
      dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(content ?? "") }}
    />
  )
}

export default withErrorBoundary(PreformattedBlock)
