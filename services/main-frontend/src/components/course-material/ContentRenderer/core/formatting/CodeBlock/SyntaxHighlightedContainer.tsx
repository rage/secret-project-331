"use client"

import "highlight.js/styles/atom-one-dark.css"
import hljs from "highlight.js"
import { memo, useEffect, useRef } from "react"

import { sanitizeCourseMaterialHtml } from "@/utils/course-material/sanitizeCourseMaterialHtml"

import { ensureLineHighlightPluginRegistered } from "./lineHighlightPlugin"
import { codeBlockStyles } from "./styles"

ensureLineHighlightPluginRegistered(hljs)

interface SyntaxHighlightedContainerProps {
  content: string | undefined
  highlightedLines?: Set<number>
  /** highlight.js language id/alias. When unset, highlight.js auto-detects the language. */
  language?: string
}

/**
 * Renders code with syntax highlighting using highlight.js. Optionally wraps lines and highlights specific lines.
 * Receives content that already uses newlines (CodeBlock normalizes `<br>` to `\n` upstream; escaped br stays literal).
 */
const SyntaxHighlightedContainer: React.FC<SyntaxHighlightedContainerProps> = ({
  content,
  highlightedLines,
  language,
}) => {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!ref.current) {
      return
    }

    delete ref.current.dataset.hljsLineWrapped
    delete ref.current.dataset.highlighted
    if (highlightedLines && highlightedLines.size > 0) {
      ref.current.dataset.highlightLines = Array.from(highlightedLines)
        .toSorted((a, b) => a - b)
        .join(",")
    } else {
      delete ref.current.dataset.highlightLines
    }

    // Reset className before re-highlighting so hljs- and language-* classes don't accumulate.
    // A chosen language sets language-<id> so highlight.js uses it instead of auto-detecting.
    // oxlint-disable-next-line i18next/no-literal-string
    ref.current.className = language ? `${codeBlockStyles} language-${language}` : codeBlockStyles

    // Sanitization is the source of truth for HTML safety; highlight.js does not preserve arbitrary HTML.
    ref.current.innerHTML = sanitizeCourseMaterialHtml(content ?? "")
    hljs.highlightElement(ref.current)
  }, [content, highlightedLines, language])

  return <code className={codeBlockStyles} ref={ref} />
}

export default memo(SyntaxHighlightedContainer)
