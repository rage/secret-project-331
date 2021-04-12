
import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"

interface ParagraphBlockAttributes {
  content: string,
  dropCap: boolean
}

const ParagraphBlock = ({ data }: BlockRendererProps) => {
  const attributes: ParagraphBlockAttributes = data.attributes
  return <p className={css`
    ${normalWidthCenteredComponentStyles}
  `}>{attributes.content}</p>
}

export default ParagraphBlock
