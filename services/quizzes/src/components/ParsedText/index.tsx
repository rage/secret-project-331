import dynamic from "next/dynamic"
import React from "react"
import "katex/dist/katex.min.css"

export interface TextNodeProps {
  text: string
}

const TextNodeImpl = dynamic(() => import("./TextNodeImpl"), { ssr: false })

const TextNode: React.FC<React.PropsWithChildren<TextNodeProps>> = (props) => (
  <TextNodeImpl {...props} />
)

import { formatText, isValidText } from "./tagParser"

interface ParsedTextProps {
  text: string
  errorText?: string
  parseLatex?: boolean
  parseMarkdown?: boolean
  inline?: boolean
}

const ParsedText: React.FC<ParsedTextProps> = ({
  text,
  errorText = undefined,
  parseLatex = false,
  parseMarkdown = false,
  inline = false,
}) => {
  if (errorText && !isValidText(parseLatex, parseMarkdown, text)) {
    return <div>{errorText}</div>
  }

  const parsedText = formatText(parseLatex, parseMarkdown, text, inline)

  return <TextNode text={parsedText} />
}

export default ParsedText
