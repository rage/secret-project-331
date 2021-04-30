import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import { defaultContainerWidth } from "../../styles/constants"

interface ImageBlockAttributes {
  alt: string
  url: string
  caption: string
  height?: number
  width?: number
}

const ImageBlock: React.FC<BlockRendererProps<ImageBlockAttributes>> = ({ data }) => {
  const attributes: ImageBlockAttributes = data.attributes
  return (
    <figure
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
      <img
        height={attributes.height}
        width={attributes.width}
        className={css`
          max-width: 100%;
        `}
        src={attributes.url}
        alt={attributes.alt}
      />
      <figcaption>{attributes.caption}</figcaption>
    </figure>
  )
}

export default ImageBlock
