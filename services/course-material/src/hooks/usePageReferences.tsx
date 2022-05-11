import { fromPairs } from "lodash"
import { useEffect, useState } from "react"
import { useQuery } from "react-query"

import { fetchCourseReferences } from "../services/backend"
import { MaterialReference } from "../shared-module/bindings"

const useReferences = (courseId: string) => {
  const [pageRefs, setPageRefs] =
    useState<{ reference: MaterialReference; referenceNumber: number }[]>()

  const getCourseReferences = useQuery(`course-${courseId}-references`, () =>
    fetchCourseReferences(courseId),
  )

  useEffect(() => {
    if (getCourseReferences.isError) {
      // eslint-disable-next-line i18next/no-literal-string
      throw "Error while loading course references"
    }
    if (getCourseReferences.data) {
      // eslint-disable-next-line i18next/no-literal-string
      const refs = document.querySelectorAll<HTMLElement>("sup.reference")

      const citationIds = Array.from(refs).map((ref) => ref.dataset.citationId)

      const filteredRefs = getCourseReferences.data.filter(
        (r) => citationIds.indexOf(r.citation_key) !== -1,
      )
      const res = filteredRefs.map((r, idx) => {
        return { reference: r, referenceNumber: idx + 1 }
      })

      setPageRefs(res)

      const refToNum = fromPairs(
        filteredRefs.map((r, idx) => {
          return [r.citation_key, idx + 1]
        }),
      )

      Array.from(refs).forEach(
        (r) =>
          (r.innerHTML = `[${
            refToNum[r.dataset.citationId ? r.dataset.citationId : "citationId"]
          }]`),
      )
    }
  }, [getCourseReferences.data, getCourseReferences.isError])

  return pageRefs
}

export default useReferences
