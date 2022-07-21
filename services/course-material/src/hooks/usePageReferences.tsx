import { fromPairs } from "lodash"
import { useContext, useEffect, useState } from "react"
import { useQuery } from "react-query"

import PageContext from "../contexts/PageContext"
import { fetchCourseReferences } from "../services/backend"
import { MaterialReference } from "../shared-module/bindings"

const useReferences = (courseId: string) => {
  const page = useContext(PageContext)
  const [pageRefs, setPageRefs] =
    useState<{ reference: MaterialReference; referenceNumber: number }[]>()

  const getCourseReferences = useQuery(`course-${courseId}-references`, () =>
    fetchCourseReferences(courseId),
  )

  useEffect(() => {
    if (!page.pageData) {
      return
    }
    let attempt = 0
    const callback = () => {
      const numReferences = document.querySelectorAll("sup.reference").length
      if (numReferences === 0 && attempt < 10) {
        attempt = attempt + 1
        setTimeout(callback, 100)
      }
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

        Array.from(refs).forEach((r) => {
          // eslint-disable-next-line i18next/no-literal-string
          r.style.position = "relative"
          // eslint-disable-next-line i18next/no-literal-string
          r.innerHTML = `<span style="color: #46749B;"}>[${
            refToNum[r.dataset.citationId ? r.dataset.citationId : "citationId"]
          }]</span>`
        })
      }
    }
    setTimeout(callback, 10)
  }, [getCourseReferences.data, getCourseReferences.isError, page])

  return pageRefs
}

export default useReferences
