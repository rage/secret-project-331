import React from "react"

import usePageReferences from "../hooks/usePageReferences"
import Reference from "../shared-module/components/Reference"
import withErrorBoundary from "../shared-module/utils/withErrorBoundary"

interface ReferencesProps {
  courseId: string
}

const ReferenceList: React.FC<React.PropsWithChildren<ReferencesProps>> = ({ courseId }) => {
  const pageRefs = usePageReferences(courseId)

  if (!pageRefs || pageRefs.length === 0) {
    return null
  }

  // NB! Don't sort these references or it can cause a mismatch!
  const refs: { id: string; text: string }[] = pageRefs.map((r) => ({
    id: r.citationKey,
    text: r.citation,
  }))
  return <Reference data={refs} />
}

export default withErrorBoundary(ReferenceList)
