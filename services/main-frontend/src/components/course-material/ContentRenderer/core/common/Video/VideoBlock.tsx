"use client"

import { css } from "@emotion/css"

import type { StringWithHTML } from "@/../types"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { sanitizeCourseMaterialHtml } from "@/utils/course-material/sanitizeCourseMaterialHtml"

import type { BlockRendererProps } from "../../.."

/** The core/video attributes this renderer uses; the generated types don't cover core/video. */
interface VideoAttributes {
  src?: string
  caption?: StringWithHTML
  poster?: string
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
  controls?: boolean
  playsInline?: boolean
  preload?: string
}

const VideoBlock: React.FC<React.PropsWithChildren<BlockRendererProps<VideoAttributes>>> = ({
  data,
}) => {
  const { autoplay, caption, controls, loop, muted, playsInline, poster, preload, src } =
    data.attributes
  return (
    <figure>
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- Gutenberg stores no caption tracks */}
      <video
        className={css`
          width: 100%;
        `}
        src={src}
        poster={poster}
        controls={controls ?? true}
        autoPlay={autoplay}
        loop={loop}
        muted={muted}
        playsInline={playsInline}
        preload={preload}
      />
      {caption && (
        <figcaption
          className={css`
            text-align: center;
            font-size: 0.8125rem;
          `}
          dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(caption) }}
        />
      )}
    </figure>
  )
}

export default withErrorBoundary(VideoBlock)
