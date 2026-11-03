"use client"

import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { useMemo } from "react"

import { formatPageCitations } from "@/components/course-material/references/formatPageCitations"
import type { Citations } from "@/components/course-material/references/formatPageCitations"
import { getCourseMaterialReferencesOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { pageContentAtom } from "@/state/course-material/selectors"
import type { Block } from "@/types/courseMaterialBlock"

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
    return formatPageCitations(pageContent as Block<unknown>[], getCourseReferences.data)
  }, [getCourseReferences.data, getCourseReferences.isError, pageContent])

  return pageRefs
}

export default useReferences
