import { css } from "@emotion/css"

import { BlockRendererProps } from "../../.."
import { AudioAttributes } from "../../../../../../types/GutenbergBlockAttributes"

import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const AudioBlock: React.FC<React.PropsWithChildren<BlockRendererProps<AudioAttributes>>> = ({
  data,
}) => {
  const { autoplay, caption, loop, preload, src } = data.attributes
  return (
    <figure>
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
