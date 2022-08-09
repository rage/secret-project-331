import DOMPurify from "dompurify"
import React from "react"

import { TextNodeProps } from "."

const sanitizeHTML = (dirty: string) => {
  return DOMPurify.sanitize(dirty, {
    RETURN_TRUSTED_TYPE: true,
    ADD_TAGS: ["semantics"],
  }).toString()
}

const TextNodeImpl: React.FC<React.PropsWithChildren<TextNodeProps>> = ({ text }) => {
  return (
    <div
      dangerouslySetInnerHTML={{
        __html: sanitizeHTML(text),
      }}
    ></div>
  )
}

export default TextNodeImpl
