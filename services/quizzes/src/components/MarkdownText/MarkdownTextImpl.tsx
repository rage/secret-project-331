import { HtmlRenderer, Parser } from "commonmark"
import React from "react"

import { MarkDownTextProps } from "."

const MarkdownTextImpl: React.FC<React.PropsWithChildren<MarkDownTextProps>> = ({ text }) => {
  const reader = new Parser()
  const writer = new HtmlRenderer()

  return (
    <div
      dangerouslySetInnerHTML={{
        __html: writer.render(reader.parse(text)),
      }}
    ></div>
  )
}

export default MarkdownTextImpl
