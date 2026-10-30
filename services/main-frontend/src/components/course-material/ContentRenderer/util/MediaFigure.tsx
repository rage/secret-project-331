"use client"

import { css } from "@emotion/css"
import React from "react"

import type { StringWithHTML } from "@/../types"
import { sanitizeCourseMaterialHtml } from "@/utils/course-material/sanitizeCourseMaterialHtml"

const figureCss = css`
  audio,
  video {
    width: 100%;
  }
`

const captionCss = css`
  text-align: center;
  font-size: 0.8125rem;
`

interface MediaFigureProps {
  caption: StringWithHTML | undefined
  children: React.ReactNode
}

/** An audio or video block: the media element at full width, with its caption below if any. */
const MediaFigure: React.FC<MediaFigureProps> = ({ caption, children }) => (
  <figure className={figureCss}>
    {children}
    {caption && (
      <figcaption
        className={captionCss}
        dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(caption) }}
      />
    )}
  </figure>
)

export default MediaFigure
