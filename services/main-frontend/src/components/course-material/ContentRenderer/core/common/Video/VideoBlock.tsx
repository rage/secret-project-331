"use client"

import type { VideoAttributes } from "@/../types/GutenbergBlockAttributes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import type { BlockRendererProps } from "../../.."
import MediaFigure from "../../../util/MediaFigure"

/** A text track as the core/video block stores it; its block.json leaves the shape open. */
interface VideoTrack {
  src?: string
  label?: string
  srcLang?: string
  kind?: "subtitles" | "captions" | "descriptions" | "chapters" | "metadata"
  default?: boolean
}

const VideoBlock: React.FC<React.PropsWithChildren<BlockRendererProps<VideoAttributes>>> = ({
  data,
}) => {
  const { autoplay, caption, controls, loop, muted, playsInline, poster, preload, src } =
    data.attributes
  const tracks = (data.attributes.tracks ?? []) as VideoTrack[]
  return (
    <MediaFigure caption={caption}>
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- captions come from the block's tracks, which can be empty */}
      <video
        src={src}
        poster={poster}
        controls={controls ?? true}
        autoPlay={autoplay}
        loop={loop}
        muted={muted}
        playsInline={playsInline}
        preload={preload}
      >
        {tracks.map((track, index) => (
          <track
            key={track.src ?? index}
            src={track.src}
            label={track.label}
            srcLang={track.srcLang}
            kind={track.kind}
            default={track.default}
          />
        ))}
      </video>
    </MediaFigure>
  )
}

export default withErrorBoundary(VideoBlock)
