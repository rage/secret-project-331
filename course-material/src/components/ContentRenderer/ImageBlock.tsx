import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"

interface ImageBlockAttributes {
  alt: string
  url: string
  caption: string
}

const ImageBlock: React.FC<BlockRendererProps<ImageBlockAttributes>> = ({ data }) => {
  const attributes: ImageBlockAttributes = data.attributes
  return (
    <figure>
      <img
        src={attributes.url}
        alt={attributes.alt}
        className={css`
          ${normalWidthCenteredComponentStyles}
        `}
      />
      <figcaption>{attributes.caption}</figcaption>
    </figure>
  )
}

export default ImageBlock
