import { css } from "@emotion/css"

import { BlockRendererProps } from "../../.."
import { courseMaterialCenteredComponentStyles } from "../../../../../shared-module/styles/componentStyles"
import withErrorBoundary from "../../../../../shared-module/utils/withErrorBoundary"
import { AudioAttributes } from "../../../../../types/GutenbergBlockAttributes"

const AudioBlock: React.FC<BlockRendererProps<AudioAttributes>> = ({ data }) => {
  const attributes: AudioAttributes = data.attributes
  return (
    <figure
      className={css`
        ${courseMaterialCenteredComponentStyles}
      `}
    >
      {/* Gutenberg schema has no support for captions */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio controls>
        <source
          src={attributes.src}
          className={css`
            ${courseMaterialCenteredComponentStyles}
          `}
        />
      </audio>
      <figcaption>{attributes.caption}</figcaption>
    </figure>
  )
}

export default withErrorBoundary(AudioBlock)
