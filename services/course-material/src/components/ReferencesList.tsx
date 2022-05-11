import React from "react"
import { useTranslation } from "react-i18next"

import usePageReferences from "../hooks/usePageReferences"
import withErrorBoundary from "../shared-module/utils/withErrorBoundary"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Cite = require("citation-js")

interface ReferencesProps {
  courseId: string
}

const TYPE = "string"
const STYLE = "vancouver"
const LANG = "en-US"
const BIBLIOGRAPHY = "bibliography"

const References: React.FC<ReferencesProps> = ({ courseId }) => {
  const pageRefs = usePageReferences(courseId)
  const { t } = useTranslation()
  return (
    <div>
      <h2>{t("references")}</h2>
      <ul>
        {pageRefs &&
          pageRefs.map((r) => {
            const c = Cite(r.reference.reference)
            const citation = c.format(BIBLIOGRAPHY, {
              type: TYPE,
              style: STYLE,
              lang: LANG,
            })
            return (
              <div key={r.referenceNumber}>
                <li>
                  <h4>{`[${r.referenceNumber}], ${citation}`}</h4>
                </li>
                <br />
              </div>
            )
          })}
      </ul>
    </div>
  )
}

export default withErrorBoundary(References)
