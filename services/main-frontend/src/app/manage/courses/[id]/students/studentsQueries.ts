import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import { useEffect } from "react"

import {
  getCourseStudentsProgressStructureOptions,
  getCourseStudentsUsersOptions,
} from "@/generated/api/@tanstack/react-query.generated"
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

/** Detail subtabs (Completions/Progress/Certificates) only render the Student column as sortable. */
export const DETAIL_SORT_COLUMNS: StudentsSortColumn[] = ["last_name"]

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
 * total page count. Next-page prefetching is owned by {@link useCourseStudentsPrefetchNextPage} so
 * it runs once (in the layout) rather than once per mounted subtab.
 */
export const useCourseStudentsIdentity = (courseId: string, params: StudentsListParams) =>
  useQuery({
    ...buildIdentityOptions(courseId, params),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    placeholderData: keepPreviousData,
  })

/**
 * Prefetches the next identity page so paging forward is instant. Call from a single owner (the
 * layout); calling it from every subtab would just re-schedule the same prefetch redundantly.
 */
export const useCourseStudentsPrefetchNextPage = (
  courseId: string,
  params: StudentsListParams,
  totalPages: number,
) => {
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
          // No keepPreviousData: on a page change the detail must not show the previous page's rows
          // (keyed by old user_ids) joined against the new identity rows — that mismatch renders
          // blank cells. Dropping it lets the isLoading guard show a spinner until this page loads.
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
          // See useCourseStudentsCompletionsDetail: no keepPreviousData to avoid stale-page joins.
        }),
    }),
  )

/**
 * Course-level progress structure (chapters + availability). Keyed by course only, so it is fetched
 * once and reused across every identity page instead of being re-downloaded per page.
 */
export const useCourseStudentsProgressStructure = (courseId: string) =>
  useQuery({
    ...getCourseStudentsProgressStructureOptions({ path: { course_id: courseId } }),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  })

/** Per-user progress detail (chapter progress + locking statuses) for the current page's users. */
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
          // See useCourseStudentsCompletionsDetail: no keepPreviousData to avoid stale-page joins.
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
