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

/** Users tab: Student column sorts by last_name, Email column by email. */
export const USERS_SORT_COLUMNS: StudentsSortColumn[] = ["last_name", "email"]

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
    // Optional keys are omitted (not set to undefined) to satisfy exactOptionalPropertyTypes.
    query: {
      page: params.page,
      limit: params.limit,
      sort_column: params.sortColumn,
      sort_direction: params.sortDirection,
      ...(params.search ? { search: params.search } : {}),
      ...(params.courseInstanceId ? { course_instance_id: params.courseInstanceId } : {}),
    },
  })

/**
 * Shared, cached identity query that drives every subtab: a page of enrolled users plus the total
 * page count. Next-page prefetching lives in {@link useCourseStudentsPrefetchNextPage}.
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
 * layout), not per subtab, to avoid redundant re-scheduling.
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

/**
 * Shared options for a user-scoped detail subtab (Completions/Certificates/Progress). Gates on a
 * non-empty page of `userIds`, keys by (prefix, courseId, ids) and POSTs those ids; the response type
 * is inferred from `fetcher`.
 *
 * No `keepPreviousData`: on a page change the previous page's rows (keyed by old user_ids) would join
 * against the new identity rows and render blank cells; without it the isLoading guard shows a spinner.
 */
const userScopedDetailOptions = <TData>(
  keyPrefix: string,
  courseId: string,
  userIds: string[],
  fetcher: (ids: string[]) => Promise<TData>,
) =>
  optionalGeneratedQueryOptions({
    value: userIds.length > 0 ? userIds : null,
    isReady: (v): v is string[] => Array.isArray(v) && v.length > 0,
    build: (ids) =>
      // `fetcher` is fixed per keyPrefix (already in the key), so it need not be in the key.
      // oxlint-disable-next-line @tanstack/query/exhaustive-deps
      queryOptions({
        // oxlint-disable-next-line i18next/no-literal-string
        queryKey: [keyPrefix, courseId, ids],
        queryFn: () => fetcher(ids),
        staleTime: STALE_TIME,
        gcTime: GC_TIME,
      }),
  })

export const useCourseStudentsCompletionsDetail = (courseId: string, userIds: string[]) =>
  useQuery(
    // oxlint-disable-next-line i18next/no-literal-string
    userScopedDetailOptions("course-students/completions", courseId, userIds, (ids) =>
      getCourseStudentsCompletions({ path: { course_id: courseId }, body: { user_ids: ids } }),
    ),
  )

export const useCourseStudentsCertificatesDetail = (courseId: string, userIds: string[]) =>
  useQuery(
    // oxlint-disable-next-line i18next/no-literal-string
    userScopedDetailOptions("course-students/certificates", courseId, userIds, (ids) =>
      getCourseStudentsCertificates({ path: { course_id: courseId }, body: { user_ids: ids } }),
    ),
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
    // oxlint-disable-next-line i18next/no-literal-string
    userScopedDetailOptions("course-students/progress", courseId, userIds, (ids) =>
      getCourseStudentsProgress({ path: { course_id: courseId }, body: { user_ids: ids } }),
    ),
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
