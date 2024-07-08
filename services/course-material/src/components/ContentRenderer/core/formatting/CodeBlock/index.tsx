import { css } from "@emotion/css"
import dynamic from "next/dynamic"

import { BlockRendererProps } from "../../.."
import { CodeAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import { fontSizeMapper } from "../../../../../styles/fontSizeMapper"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import Spinner from "@/shared-module/common/components/Spinner"
import { monospaceFont } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const SyntaxHighlightedContainerLoading = <Spinner variant="medium" />

const SyntaxHighlightedContainer = dynamic(() => import("./SyntaxHighlightedContainer"), {
  ssr: true,
  loading: () => SyntaxHighlightedContainerLoading,
})

const CodeBlock: React.FC<React.PropsWithChildren<BlockRendererProps<CodeAttributes>>> = ({
  data,
  dontAllowBlockToBeWiderThanContainerWidth,
}) => {
  const { anchor, content, fontSize } = data.attributes
  return (
    <BreakFromCentered sidebar={false} disabled={dontAllowBlockToBeWiderThanContainerWidth}>
      <pre
        className={css`
          max-width: 1000px;
          margin: 0 auto;
          ${dontAllowBlockToBeWiderThanContainerWidth &&
          // If this is inside a container, large margins don't look good.
          `margin-top: -1.5rem;
            margin-bottom: -1.5rem;
            `}
          ${fontSize && `font-size: ${fontSizeMapper(fontSize)};`}
          font-family: ${monospaceFont} !important;
          line-height: 1.75rem;
          white-space: pre-wrap;
          overflow-wrap: break-word;
        `}
        {...(anchor && { id: anchor })}
      >
        <SyntaxHighlightedContainer content={content} />
      </pre>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(CodeBlock)
