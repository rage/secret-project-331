import "highlight.js/styles/atom-one-dark.css"
import { css } from "@emotion/css"
import hljs from "highlight.js"
import { useEffect, useRef } from "react"

import { sanitizeCourseMaterialHtml } from "../../../../../utils/sanitizeCourseMaterialHtml"

interface SyntaxHighlightedContainerProps {
  content: string | undefined
}

const SyntaxHighlightedContainer: React.FC<SyntaxHighlightedContainerProps> = ({ content }) => {
  const ref = useRef<HTMLElement>(null)
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
      `}
      ref={ref}
      dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(content ?? "") }}
    />
  )
}

export default SyntaxHighlightedContainer
