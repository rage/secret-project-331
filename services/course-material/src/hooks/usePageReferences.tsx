import { fromPairs } from "lodash"
import { useEffect, useState } from "react"
import { useQuery } from "react-query"

import { fetchCourseReferences } from "../services/backend"
import { MaterialReference } from "../shared-module/bindings"

const useReferences: (courseId: string) => unknown = (courseId) => {
  const [pageRefs, setPageRefs] = useState<MaterialReference[]>()
  const getCourseReferences = useQuery(`course-${courseId}-references`, () =>
    fetchCourseReferences(courseId),
  )

  useEffect(() => {
    if (getCourseReferences.isError) {
      throw "Error while loading course references"
    }
    if (getCourseReferences.data) {
      const refs = document.querySelectorAll<HTMLElement>("sup.reference")
      console.log(refs)
      const citationIds = Array.from(refs).map((ref) => ref.dataset.citationId)
      const filteredRefs = getCourseReferences.data.filter(
        (r) => citationIds.indexOf(r.citation_key) !== -1,
      )

      setPageRefs(filteredRefs)

      const refToNum = fromPairs(
        filteredRefs.map((r, idx) => {
          return [r.citation_key, idx + 1]
        }),
      )

      Array.from(refs).forEach((r) => (r.innerHTML = `[${refToNum[r.dataset.citationId]}]`))
    }
  }, [getCourseReferences.data, getCourseReferences.isError])

  return pageRefs
}

export default useReferences
