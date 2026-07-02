"use client"

import { css } from "@emotion/css"
import DOMPurify from "dompurify"
import React from "react"

import { TextNodeProps } from "."

const sanitizeHTML = (dirty: string) => {
  return DOMPurify.sanitize(dirty, {
    RETURN_TRUSTED_TYPE: true,
    ADD_TAGS: ["semantics"],
  }).toString()
}

// The parsed markdown/latex HTML is injected verbatim, so it needs its own rules to stay inside the
// container instead of overflowing to the right. `overflow-wrap: anywhere` also lowers the intrinsic
// min-content width so flex / max-width ancestors can shrink it (plain `break-word` does not).
const parsedContentStyles = css`
  overflow-wrap: anywhere;
  max-width: 100%;

  /* Code wraps instead of forcing a horizontal scrollbar. */
  pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-width: 100%;
  }
  code {
    overflow-wrap: anywhere;
  }

  /* Media and tables stay within the container width. */
  img,
  svg,
  video {
    max-width: 100%;
    height: auto;
  }
  table {
    display: block;
    max-width: 100%;
    overflow-x: auto;
  }

  /* Long display math scrolls locally; inline math keeps its glyph spans intact. */
  .katex {
    overflow-wrap: normal;
  }
  .katex-display {
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
  }
`

const TextNodeImpl: React.FC<React.PropsWithChildren<TextNodeProps>> = ({ text, inline }) => {
  // eslint-disable-next-line i18next/no-literal-string
  const Tag = inline ? "span" : "div"
  return (
    <Tag
      className={parsedContentStyles}
      dangerouslySetInnerHTML={{
        __html: sanitizeHTML(text),
      }}
    ></Tag>
  )
}

export default TextNodeImpl
