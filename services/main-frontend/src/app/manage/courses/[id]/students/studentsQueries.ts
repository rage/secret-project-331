import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import { useEffect } from "react"

import { getCourseStudentsUsersOptions } from "@/generated/api/@tanstack/react-query.generated"
import {
  getCourseStudentsCertificates,
  getCourseStudentsCompletions,
  getCourseStudentsProgress,
} from "@/generated/api/sdk.generated"
import { queryClient } from "@/shared-module/common/services/appQueryClient"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

export type SortDirection = "asc" | "desc"

/** Server sort keys accepted by the identity endpoint. */
export type StudentsSortColumn = "last_name" | "first_name" | "email"

export interface StudentsListParams {
  page: number
  limit: number
  /** Debounced, trimmed search text ("" when empty). */
  search: string
  sortColumn: StudentsSortColumn
  sortDirection: SortDirection
  courseInstanceId: string | null
}

// Explicit caching opt-in: the global QueryClient sets gcTime ~0, so without these the shared
// identity page and the per-page detail would refetch on every tab switch / remount.
const STALE_TIME = 60_000
const GC_TIME = 5 * 60_000

const buildIdentityOptions = (courseId: string, params: StudentsListParams) =>
  getCourseStudentsUsersOptions({
    path: { course_id: courseId },
    query: {
      page: params.page,
      limit: params.limit,
      search: params.search || undefined,
      sort_column: params.sortColumn,
      sort_direction: params.sortDirection,
      course_instance_id: params.courseInstanceId ?? undefined,
    },
  })

/**
 * Shared, cached identity query that drives every subtab. Returns a page of enrolled users and the
 * total page count, and prefetches the next page so paging forward is instant.
 */
export const useCourseStudentsIdentity = (courseId: string, params: StudentsListParams) => {
  const query = useQuery({
    ...buildIdentityOptions(courseId, params),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    placeholderData: keepPreviousData,
  })

  const totalPages = query.data?.total_pages ?? 0
  const hasNextPage = params.page < totalPages

  useEffect(() => {
    if (!hasNextPage) {
      return
    }
    void queryClient.prefetchQuery({
      ...buildIdentityOptions(courseId, {
        page: params.page + 1,
        limit: params.limit,
        search: params.search,
        sortColumn: params.sortColumn,
        sortDirection: params.sortDirection,
        courseInstanceId: params.courseInstanceId,
      }),
      staleTime: STALE_TIME,
      gcTime: GC_TIME,
    })
  }, [
    courseId,
    hasNextPage,
    params.page,
    params.limit,
    params.search,
    params.sortColumn,
    params.sortDirection,
    params.courseInstanceId,
  ])

  return query
}

export const useCourseStudentsCompletionsDetail = (courseId: string, userIds: string[]) =>
  useQuery(
    optionalGeneratedQueryOptions({
      value: userIds.length > 0 ? userIds : null,
      isReady: (v): v is string[] => Array.isArray(v) && v.length > 0,
      build: (ids) =>
        queryOptions({
          // oxlint-disable-next-line i18next/no-literal-string
          queryKey: ["course-students/completions", courseId, ids],
          queryFn: () =>
            getCourseStudentsCompletions({
              path: { course_id: courseId },
              body: { user_ids: ids },
            }),
          staleTime: STALE_TIME,
          gcTime: GC_TIME,
          placeholderData: keepPreviousData,
        }),
    }),
  )

export const useCourseStudentsCertificatesDetail = (courseId: string, userIds: string[]) =>
  useQuery(
    optionalGeneratedQueryOptions({
      value: userIds.length > 0 ? userIds : null,
      isReady: (v): v is string[] => Array.isArray(v) && v.length > 0,
      build: (ids) =>
        queryOptions({
          // oxlint-disable-next-line i18next/no-literal-string
          queryKey: ["course-students/certificates", courseId, ids],
          queryFn: () =>
            getCourseStudentsCertificates({
              path: { course_id: courseId },
              body: { user_ids: ids },
            }),
          staleTime: STALE_TIME,
          gcTime: GC_TIME,
          placeholderData: keepPreviousData,
        }),
    }),
  )

export const useCourseStudentsProgressDetail = (courseId: string, userIds: string[]) =>
  useQuery(
    optionalGeneratedQueryOptions({
      value: userIds.length > 0 ? userIds : null,
      isReady: (v): v is string[] => Array.isArray(v) && v.length > 0,
      build: (ids) =>
        queryOptions({
          // oxlint-disable-next-line i18next/no-literal-string
          queryKey: ["course-students/progress", courseId, ids],
          queryFn: () =>
            getCourseStudentsProgress({
              path: { course_id: courseId },
              body: { user_ids: ids },
            }),
          staleTime: STALE_TIME,
          gcTime: GC_TIME,
          placeholderData: keepPreviousData,
        }),
    }),
  )

/** "Last, First" for a sorted student list; falls back to the single set name or a generic label. */
export const formatStudentName = (
  row: { first_name?: string | null; last_name?: string | null },
  t: TFunction,
): string => {
  const first = (row.first_name ?? "").trim()
  const last = (row.last_name ?? "").trim()
  if (!first && !last) {
    return t("missing-name")
  }
  if (first && last) {
    return `${last}, ${first}`
  }
  return first || last
}
