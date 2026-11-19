"use client"

import type { AudioAttributes } from "@/../types/GutenbergBlockAttributes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import type { BlockRendererProps } from "../../.."
import MediaFigure from "../../../util/MediaFigure"

const AudioBlock: React.FC<React.PropsWithChildren<BlockRendererProps<AudioAttributes>>> = ({
  data,
}) => {
  const { autoplay, caption, loop, preload, src } = data.attributes
  return (
    <MediaFigure caption={caption}>
      {/* Gutenberg schema has no support for captions */}
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
      <audio controls autoPlay={autoplay} preload={preload} loop={loop}>
        <source src={src} />
      </audio>
    </MediaFigure>
  )
}

export default withErrorBoundary(AudioBlock)
