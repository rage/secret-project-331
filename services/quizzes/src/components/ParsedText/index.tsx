"use client"

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
   * Wrap the output in a block element (`<div>`) instead of letting `inline` decide. Keeps math
   * rendering inline (that is still driven by `inline`) while allowing the text to contain
   * block-level content — notably multi-paragraph markdown, whose `<p>` tags are invalid HTML
   * inside the inline `<span>` `inline` would otherwise produce. Use for feedback that renders
   * markdown but should still keep inline math.
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
