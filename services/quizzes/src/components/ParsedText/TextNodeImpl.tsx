import DOMPurify from "dompurify"
import React from "react"

import { TextNodeProps } from "."

const sanitizeHTML = (dirty: string) => {
  return DOMPurify.sanitize(dirty, {
    RETURN_TRUSTED_TYPE: true,
    ADD_TAGS: ["semantics"],
  }).toString()
}

const TextNodeImpl: React.FC<React.PropsWithChildren<TextNodeProps>> = ({ text, inline }) => {
  const Tag = inline ? "span" : "div"
  return (
    <Tag
      dangerouslySetInnerHTML={{
        __html: sanitizeHTML(text),
      }}
    ></Tag>
  )
}

export default TextNodeImpl
