import "highlight.js/styles/atom-one-dark.css"
import { css } from "@emotion/css"
import hljs from "highlight.js"
import { useEffect, useMemo, useRef } from "react"

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

  // The content coming from gutenberg contains <br> tags which do not work when we higlight the code with hljs
  // So we'll replace the br tags with newlines
  const replacedContent = useMemo(() => {
    return content?.replace(/<br\s*\\?>/g, "\n") ?? ""
  }, [content])

  return (
    <code
      className={css`
        background-color: #1a2333;
        border-radius: 4px;
      `}
      ref={ref}
      dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(replacedContent) }}
    />
  )
}

export default SyntaxHighlightedContainer
