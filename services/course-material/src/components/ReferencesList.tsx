import React from "react"

import usePageReferences from "../hooks/usePageReferences"
import Reference from "../shared-module/components/Reference"
import Spinner from "../shared-module/components/Spinner"
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

const ReferenceList: React.FC<ReferencesProps> = ({ courseId }) => {
  const pageRefs = usePageReferences(courseId)

  if (!pageRefs) {
    return <Spinner variant="medium" />
  }

  const refs: { id: string; text: string }[] = pageRefs.map((r) => {
    const c = Cite(r.reference.reference)
    return {
      id: r.reference.citation_key,
      text: c.format(BIBLIOGRAPHY, {
        type: TYPE,
        style: STYLE,
        lang: LANG,
      }),
    }
  })
  return <Reference data={refs} />
}

export default withErrorBoundary(ReferenceList)
