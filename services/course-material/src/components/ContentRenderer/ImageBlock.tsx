import { css } from "@emotion/css"

import { normalWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import { ImageAttributes } from "../../types/GutenbergBlockAttributes"

import { BlockRendererProps } from "."

const ImageBlock: React.FC<BlockRendererProps<ImageAttributes>> = ({ data }) => {
  const attributes: ImageAttributes = data.attributes
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
