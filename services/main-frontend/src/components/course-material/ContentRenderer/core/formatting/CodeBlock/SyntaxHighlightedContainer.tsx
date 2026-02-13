"use client"

import "highlight.js/styles/atom-one-dark.css"
import { css } from "@emotion/css"
import hljs from "highlight.js"
import { memo, useEffect, useMemo, useRef } from "react"

import { ensureLineHighlightPluginRegistered } from "./lineHighlightPlugin"
import { replaceBrTagsWithNewlines } from "./utils"

import { sanitizeCourseMaterialHtml } from "@/utils/course-material/sanitizeCourseMaterialHtml"

ensureLineHighlightPluginRegistered(hljs)

interface SyntaxHighlightedContainerProps {
  content: string | undefined
  highlightedLines?: Set<number>
}

const codeBlockStyles = css`
  background-color: #1a2333;
  border-radius: 4px;
  font-variant-ligatures: none;
  font-feature-settings: "liga" 0;
  .code-line {
    display: block;
  }
  .highlighted-line {
    background-color: rgba(255, 255, 100, 0.1);
    margin: 0 -16px;
    padding: 0 16px 0 13px;
    border-left: 3px solid #ffd700;
  }
`

/**
 * Renders code with syntax highlighting using highlight.js. Optionally wraps lines and highlights specific lines.
 */
const SyntaxHighlightedContainer: React.FC<SyntaxHighlightedContainerProps> = ({
  content,
  highlightedLines,
}) => {
  const ref = useRef<HTMLElement>(null)

  const replacedContent = useMemo(() => {
    return replaceBrTagsWithNewlines(content) ?? ""
  }, [content])

  useEffect(() => {
    if (!ref.current) {
      return
    }

    delete ref.current.dataset.hljsLineWrapped
    if (highlightedLines && highlightedLines.size > 0) {
      ref.current.dataset.highlightLines = Array.from(highlightedLines)
        .sort((a, b) => a - b)
        .join(",")
    } else {
      delete ref.current.dataset.highlightLines
    }

    // Sanitization is the source of truth for HTML safety; highlight.js does not preserve arbitrary HTML.
    ref.current.innerHTML = sanitizeCourseMaterialHtml(replacedContent)
    hljs.highlightElement(ref.current)
  }, [replacedContent, highlightedLines])

  return <code className={codeBlockStyles} ref={ref} />
}

export default memo(SyntaxHighlightedContainer)
