import dynamic from "next/dynamic"
import React, { useMemo } from "react"
import "katex/dist/katex.min.css"

export interface TextNodeProps {
  text: string
  inline?: boolean
}

const TextNodeImpl = dynamic(() => import("./TextNodeImpl"), { ssr: false })

const TextNode: React.FC<React.PropsWithChildren<TextNodeProps>> = (props) => (
  <TextNodeImpl {...props} />
)

import { formatText, isValidText } from "./tagParser"

interface ParsedTextProps {
  text: string | null
  errorText?: string
  parseLatex?: boolean
  parseMarkdown?: boolean
  inline?: boolean
  addDotToEnd?: boolean
}

const ParsedText: React.FC<ParsedTextProps> = ({
  text,
  errorText = undefined,
  parseLatex = false,
  parseMarkdown = false,
  inline = false,
  addDotToEnd = false,
}) => {
  const withDotIfNeeded = useMemo(() => {
    if (text === null || text === undefined) {
      return null
    }
    if (!addDotToEnd) {
      return text
    }
    const trimmedText = text.trim()
    if (
      !trimmedText.endsWith(".") &&
      !trimmedText.endsWith("!") &&
      !trimmedText.endsWith("?") &&
      !trimmedText.endsWith("]")
    ) {
      return trimmedText + "."
    }
    return text
  }, [addDotToEnd, text])
  if (withDotIfNeeded === null) {
    return null
  }

  if (errorText && !isValidText(parseLatex, parseMarkdown, withDotIfNeeded)) {
    return <div>{errorText}</div>
  }

  const parsedText = formatText(parseLatex, parseMarkdown, withDotIfNeeded, inline)

  return <TextNode inline={inline} text={parsedText} />
}

export default ParsedText
