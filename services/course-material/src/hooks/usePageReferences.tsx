import { useQuery } from "@tanstack/react-query"
// @ts-expect-error: No type definitions
import cite from "citation-js"
import { compact } from "lodash"
import { useContext, useEffect, useState } from "react"

import PageContext from "../contexts/PageContext"
import { fetchCourseReferences } from "../services/backend"

const BIBLIOGRAPHY = "bibliography"
const EN_US = "en-US"
const STRING = "string"
const VANCOUVER = "vancouver"

export interface Citations {
  citation: string
  citationKey: string
  citationNumber: number
}

const useReferences = (courseId: string) => {
  const page = useContext(PageContext)
  const [pageRefs, setPageRefs] = useState<ReadonlyArray<Citations>>()

  const getCourseReferences = useQuery({
    queryKey: [`course-${courseId}-references`],
    queryFn: () => fetchCourseReferences(courseId),
  })

  useEffect(() => {
    if (!page.pageData) {
      return
    }
    let attempt = 0
    const callback = () => {
      // eslint-disable-next-line i18next/no-literal-string
      const refs = document.querySelectorAll<HTMLElement>("sup.reference")
      const numReferences = refs.length
      if (numReferences === 0 && attempt < 10) {
        attempt = attempt + 1
        setTimeout(callback, 100)
      }
      if (getCourseReferences.isError) {
        // eslint-disable-next-line i18next/no-literal-string
        throw "Error while loading course references"
      }
      if (getCourseReferences.data) {
        const textCitations = new Set(compact(Array.from(refs).map((x) => x.dataset.citationId)))
        const citations = getCourseReferences.data
          .filter((x) => textCitations.has(x.citation_key))
          .map((x) => ({
            citationKey: x.citation_key,
            text: cite(x.reference).format(BIBLIOGRAPHY, {
              type: STRING,
              style: VANCOUVER,
              lang: EN_US,
            }),
          }))
          .sort((a, b) => a.text.localeCompare(b.text))
          .map((x, i) => ({
            citationKey: x.citationKey,
            citationNumber: i + 1,
            citation: x.text,
          }))

        setPageRefs(citations)

        const citationsMap = new Map(citations.map((x) => [x.citationKey, x]))
        Array.from(refs).forEach((r) => {
          // eslint-disable-next-line i18next/no-literal-string
          r.style.position = "relative"
          // eslint-disable-next-line i18next/no-literal-string
          r.innerHTML = `<span style="color: #46749B;"}>[${
            citationsMap.get(r.dataset.citationId ?? "")?.citationNumber
          }]</span>`
        })
      }
    }
    setTimeout(callback, 10)
  }, [getCourseReferences.data, getCourseReferences.isError, page])

  return pageRefs
}

export default useReferences
