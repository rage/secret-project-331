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
// container instead of overflowing to the right. `break-word` breaks a token only when it cannot fit
// on its own line, so normal words still wrap at word boundaries — unlike `anywhere`, which lowers
// the min-content width to a single character and shatters short words mid-word in narrow columns
// (e.g. a multiple-choice option showing "sho / rt / ans / wer").
const parsedContentStyles = css`
  overflow-wrap: break-word;
  max-width: 100%;

  /* Code wraps instead of forcing a horizontal scrollbar. */
  pre {
    white-space: pre-wrap;
    overflow-wrap: break-word;
    max-width: 100%;
  }
  code {
    overflow-wrap: break-word;
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
  // oxlint-disable-next-line i18next/no-literal-string
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
