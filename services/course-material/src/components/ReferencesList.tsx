// @ts-expect-error: No type definitions
import cite from "citation-js"
import React from "react"

import usePageReferences from "../hooks/usePageReferences"
import Reference from "../shared-module/components/Reference"
import withErrorBoundary from "../shared-module/utils/withErrorBoundary"

interface ReferencesProps {
  courseId: string
}

const TYPE = "string"
const STYLE = "vancouver"
const LANG = "en-US"
const BIBLIOGRAPHY = "bibliography"

const ReferenceList: React.FC<React.PropsWithChildren<ReferencesProps>> = ({ courseId }) => {
  const pageRefs = usePageReferences(courseId)

  if (!pageRefs || pageRefs.length === 0) {
    return null
  }

  const refs: { id: string; text: string }[] = pageRefs.map((r) => {
    const c = cite(r.reference.reference)
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
