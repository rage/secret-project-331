import Cite from "citation-js"
import React from "react"

interface ReferencesProps {
  references: string[]
}

const FORMAT = "html"
const TEMPLATE = "vancouver"
const LANG = "en-US"
const BIBLIOGRAPHY = "bibliography"

const References: React.FC<ReferencesProps> = ({ references }) => {
  return (
    <div>
      <ul>
        {references.map((r, idx) => {
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
