import "highlight.js/styles/atom-one-dark.css"
import { css } from "@emotion/css"
import hljs from "highlight.js"
import { memo, useEffect, useMemo, useRef } from "react"

import { sanitizeCourseMaterialHtml } from "../../../../../utils/sanitizeCourseMaterialHtml"

interface SyntaxHighlightedContainerProps {
  content: string | undefined
}

/**
 * Renders code with syntax highlighting using highlight.js.
 */
const SyntaxHighlightedContainer: React.FC<SyntaxHighlightedContainerProps> = ({ content }) => {
  const ref = useRef<HTMLElement>(null)

  const replacedContent = useMemo(() => {
    let res = content ?? ""
    res = res.replace(/<br\s*\\?>/g, "\n")
    return res
  }, [content])

  useEffect(() => {
    if (!ref.current) {
      return
    }
    hljs.highlightElement(ref.current)
  }, [ref])

  return (
    <code
      className={css`
        background-color: #1a2333;
        border-radius: 4px;
        font-variant-ligatures: none;
        font-feature-settings: "liga" 0;
      `}
      ref={ref}
      dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(replacedContent) }}
    />
  )
}

export default memo(SyntaxHighlightedContainer)
