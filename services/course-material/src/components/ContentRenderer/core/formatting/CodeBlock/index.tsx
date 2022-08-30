import { css } from "@emotion/css"
import dynamic from "next/dynamic"

import { BlockRendererProps } from "../../.."
import { CodeAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import Spinner from "../../../../../shared-module/components/Spinner"
import { monospaceFont } from "../../../../../shared-module/styles"
import fontSizeMapper from "../../../../../styles/fontSizeMapper"

const SyntaxHighlightedContainerLoading = <Spinner variant="medium" />

const SyntaxHighlightedContainer = dynamic(() => import("./SyntaxHighlightedContainer"), {
  ssr: true,
  loading: () => SyntaxHighlightedContainerLoading,
})

const CodeBlock: React.FC<React.PropsWithChildren<BlockRendererProps<CodeAttributes>>> = ({
  data,
}) => {
  const { anchor, content, fontSize } = data.attributes
  return (
    <pre
      className={css`
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
  )
}

export default CodeBlock
