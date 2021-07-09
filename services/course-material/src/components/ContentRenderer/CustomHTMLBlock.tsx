import { css } from "@emotion/css"
import sanitizeHtml from "sanitize-html"

import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"

import { BlockRendererProps } from "."

interface CustomHTMLBlockAttributes {
  content: string
}

const CustomHTMLBlock: React.FC<BlockRendererProps<CustomHTMLBlockAttributes>> = ({ data }) => {
  const attributes: CustomHTMLBlockAttributes = data.attributes
  return (
    <pre
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
      <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(attributes.content) }}></div>
    </pre>
  )
}

export default CustomHTMLBlock
