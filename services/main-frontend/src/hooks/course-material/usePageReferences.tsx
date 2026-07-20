"use client"

import { useQuery } from "@tanstack/react-query"
// @ts-expect-error: No type definitions
import cite from "citation-js"
import { useAtomValue } from "jotai"
import { useMemo } from "react"

import { orderedUniqueCitationKeys } from "@/components/course-material/references/citationExtraction"
import { getCourseMaterialReferencesOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { pageContentAtom } from "@/state/course-material/selectors"
import type { Block } from "@/types/courseMaterialBlock"

const BIBLIOGRAPHY = "bibliography"
const EN_US = "en-US"
const STRING = "string"
const VANCOUVER = "vancouver"

export interface Citations {
  citation: string
  citationKey: string
}

const useReferences = (courseId: string) => {
  const pageContent = useAtomValue(pageContentAtom)

  const getCourseReferences = useQuery(
    getCourseMaterialReferencesOptions({
      path: {
        course_id: courseId,
      },
    }),
  )

  // Citations are derived from the page content block tree, not the rendered DOM, so citations
  // inside collapsed expandable blocks are included and the numbering is deterministic. Numbers
  // follow first-occurrence document order (the Vancouver convention) so they match the inline
  // markers.
  const pageRefs = useMemo<readonly Citations[] | undefined>(() => {
    if (getCourseReferences.isError) {
      // Surface the failure to the error boundary instead of silently returning an empty list,
      // which would drop the whole references section while inline \cite markers still render.
      throw new TypeError("Error while loading course references")
    }
    if (!getCourseReferences.data) {
      return undefined
    }
    const orderedKeys = orderedUniqueCitationKeys(pageContent as Block<unknown>[])
    if (orderedKeys.length === 0) {
      return []
    }
    const referenceByKey = new Map(getCourseReferences.data.map((x) => [x.citation_key, x]))
    const citations: Citations[] = []
    for (const key of orderedKeys) {
      const reference = referenceByKey.get(key)
      if (!reference) {
        continue
      }
      // citation-js throws on a malformed/unsupported reference string. Skip the bad entry rather
      // than letting a single reference throw during render and take out the whole accordion.
      try {
        citations.push({
          citationKey: key,
          citation: cite(reference.reference).format(BIBLIOGRAPHY, {
            type: STRING,
            style: VANCOUVER,
            lang: EN_US,
          }),
        })
      } catch {
        continue
      }
    }
    return citations
  }, [getCourseReferences.data, getCourseReferences.isError, pageContent])

  return pageRefs
}

export default useReferences
