import type { QueryClient } from "@tanstack/react-query"
import { atomWithQuery } from "jotai-tanstack-query"

import { viewParamsAtom } from "./params"

import {
  fetchCoursePageByPath,
  fetchExam,
  fetchExamForTesting,
} from "@/services/course-material/backend"

const QUERY_KEYS = {
  MATERIAL_ROOT: "course-page",
  EXAM_ROOT: "exam-page",
  material: (type: string | undefined, slug: string, path: string) =>
    [QUERY_KEYS.MATERIAL_ROOT, type, slug, path] as const,
  exam: (type: string | undefined, id: string, isTest: boolean) =>
    [QUERY_KEYS.EXAM_ROOT, type, id, isTest] as const,
} as const

/** Query atom for fetching course material page data. */
export const materialQueryAtom = atomWithQuery((get) => {
  const viewParams = get(viewParamsAtom)
  const isMaterialView = viewParams?.type === "material"
  const materialCourseSlug = viewParams?.type === "material" ? viewParams.courseSlug : ""
  const materialPath = viewParams?.type === "material" ? viewParams.path : ""

  return {
    queryKey: QUERY_KEYS.material(viewParams?.type, materialCourseSlug, materialPath),
    queryFn: async () => {
      if (viewParams?.type !== "material") {
        throw new Error("Invalid query param")
      }
      return fetchCoursePageByPath(materialCourseSlug, materialPath)
    },
    enabled: isMaterialView,
    suspense: false,
  }
})

/** Query atom for fetching exam data. */
export const examQueryAtom = atomWithQuery((get) => {
  const viewParams = get(viewParamsAtom)
  const isExamView = viewParams?.type === "exam"
  const examId = viewParams?.type === "exam" ? viewParams.examId : ""
  const isTestMode = viewParams?.type === "exam" ? viewParams.isTestMode : false

  return {
    queryKey: QUERY_KEYS.exam(viewParams?.type, examId, isTestMode),
    queryFn: async () => {
      if (viewParams?.type !== "exam") {
        throw new Error("Invalid query param")
      }
      return isTestMode ? fetchExamForTesting(examId) : fetchExam(examId)
    },
    enabled: isExamView,
    suspense: false,
  }
})

/**
 * Invalidates all course material state related queries (pages, exams, etc).
 * Use this when settings (like language or cohort) change.
 */
export async function invalidateCourseMaterialStateQueries(
  queryClient: QueryClient,
  courseId: string | null,
) {
  await queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey
      if (!Array.isArray(key)) {
        return false
      }

      // Check against the private Root Constants.
      // If we change the constants above, this logic automatically updates.
      const isCourseMaterialQuery =
        key[0] === QUERY_KEYS.MATERIAL_ROOT || key[0] === QUERY_KEYS.EXAM_ROOT

      // Matches legacy queries or other components that might use the courseId directly
      const hasCourseId = courseId && key.some((k) => k === courseId || k === `courses-${courseId}`)

      return isCourseMaterialQuery || !!hasCourseId
    },
  })
}
