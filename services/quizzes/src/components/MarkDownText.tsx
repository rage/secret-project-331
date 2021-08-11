import { HtmlRenderer, Parser } from "commonmark"
import React from "react"

interface MarkDownTextProps {
  text: string
}

export const MarkDownText: React.FC<MarkDownTextProps> = ({ text }) => {
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
