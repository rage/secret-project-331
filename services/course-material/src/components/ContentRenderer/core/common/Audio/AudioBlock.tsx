import { css } from "@emotion/css"

import { BlockRendererProps } from "../../.."
import { courseMaterialCenteredComponentStyles } from "../../../../../shared-module/styles/componentStyles"
import withErrorBoundary from "../../../../../shared-module/utils/withErrorBoundary"
import { AudioAttributes } from "../../../../../types/GutenbergBlockAttributes"

const AudioBlock: React.FC<BlockRendererProps<AudioAttributes>> = ({ data }) => {
  const { anchor, autoplay, caption, loop, preload, src } = data.attributes
  return (
    <figure
      className={css`
        ${courseMaterialCenteredComponentStyles}
      `}
      {...(anchor && { id: anchor })}
    >
      {/* Gutenberg schema has no support for captions */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        className={css`
          width: 100%;
        `}
        controls
        autoPlay={autoplay}
        preload={preload}
        loop={loop}
      >
        <source src={src} />
      </audio>
      <figcaption
        className={css`
          text-align: center;
          font-size: 0.8125rem;
        `}
      >
        {caption}
      </figcaption>
    </figure>
  )
}

export default withErrorBoundary(AudioBlock)
