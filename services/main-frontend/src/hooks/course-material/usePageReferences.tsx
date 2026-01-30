"use client"

import { useQuery } from "@tanstack/react-query"
// @ts-expect-error: No type definitions
import cite from "citation-js"
import { useAtomValue } from "jotai"
import { compact } from "lodash"
import { useEffect, useState } from "react"

import { fetchCourseReferences } from "@/services/course-material/backend"
import { currentPageDataAtom } from "@/state/course-material/selectors"

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
  const pageData = useAtomValue(currentPageDataAtom)
  const [pageRefs, setPageRefs] = useState<ReadonlyArray<Citations>>()

  const getCourseReferences = useQuery({
    queryKey: [`course-${courseId}-references`],
    queryFn: () => fetchCourseReferences(courseId),
  })

  useEffect(() => {
    if (!pageData) {
      return
    }
    let attempt = 0
    const callback = () => {
      const refs = document.querySelectorAll<HTMLElement>("[data-citation-id]")
      const numReferences = refs.length
      if (numReferences === 0 && attempt < 10) {
        attempt = attempt + 1
        setTimeout(callback, 100)
      }
      if (getCourseReferences.isError) {
        throw new Error("Error while loading course references")
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
      }
    }
    setTimeout(callback, 10)
  }, [getCourseReferences.data, getCourseReferences.isError, pageData])

  return pageRefs
}

export default useReferences
