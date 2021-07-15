import { css } from "@emotion/css"

import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import { AudioAttributes } from "../../types/GutenbergBlockAttributes"

import { BlockRendererProps } from "."

const AudioBlock: React.FC<BlockRendererProps<AudioAttributes>> = ({ data }) => {
  const attributes: AudioAttributes = data.attributes
  return (
    <figure
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
      <audio controls>
        <source
          src={attributes.src}
          className={css`
            ${normalWidthCenteredComponentStyles}
          `}
        />
      </audio>
      <figcaption>{attributes.caption}</figcaption>
    </figure>
  )
}

export default withErrorBoundary(AudioBlock)
