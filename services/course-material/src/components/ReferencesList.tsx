import Cite from "citation-js"
import React from "react"

import usePageReferences from "../hooks/usePageReferences"

interface ReferencesProps {
  courseId: string
}

const FORMAT = "text"
const TEMPLATE = "vancouver"
const LANG = "en-US"
const BIBLIOGRAPHY = "bibliography"

const References: React.FC<ReferencesProps> = ({ courseId }) => {
  const pageRefs = usePageReferences(courseId)
  return (
    <div>
      <ul>
        {pageRefs &&
          pageRefs.map((r, idx) => {
            const c = Cite(r)
            return (
              <li key={idx}>
                {c.format(BIBLIOGRAPHY, {
                  format: FORMAT,
                  template: TEMPLATE,
                  lang: LANG,
                })}
              </li>
            )
          })}
      </ul>
    </div>
  )
}

export default References
