import React, { useMemo } from "react"
import "katex/dist/katex.min.css"

import { formatText, isValidText } from "./tagParser"

import dynamicImport from "@/shared-module/common/utils/dynamicImport"

export interface TextNodeProps {
  text: string
  inline?: boolean
}

const TextNodeImpl = dynamicImport<TextNodeProps>(() => import("./TextNodeImpl"))

const TextNode: React.FC<React.PropsWithChildren<TextNodeProps>> = (props) => (
  <TextNodeImpl {...props} />
)

interface ParsedTextProps {
  text: string | null
  errorText?: string
  parseLatex?: boolean
  parseMarkdown?: boolean
  inline?: boolean
  /**
   * Wrap output in a block `<div>` while keeping math inline (still driven by `inline`). Use for
   * markdown that may be multi-paragraph, whose `<p>` tags are invalid inside an inline `<span>`.
   */
  blockContainer?: boolean
  addDotToEnd?: boolean
}

const ParsedText: React.FC<ParsedTextProps> = ({
  text,
  errorText = undefined,
  parseLatex = false,
  parseMarkdown = false,
  inline = false,
  blockContainer = false,
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

  // Math stays inline per `inline`; `blockContainer` only forces a block wrapper element.
  return <TextNode inline={blockContainer ? false : inline} text={parsedText} />
}

export default ParsedText
