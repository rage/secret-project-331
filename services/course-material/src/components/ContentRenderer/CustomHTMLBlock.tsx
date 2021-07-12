import { css } from "@emotion/css"
import sanitizeHtml from "sanitize-html"
import { HtmlAttributes } from "../../types/GutenbergBlockAttributes"

const CustomHTMLBlock: React.FC<BlockRendererProps<HtmlAttributes>> = ({ data }) => {
  const attributes: HtmlAttributes = data.attributes
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
