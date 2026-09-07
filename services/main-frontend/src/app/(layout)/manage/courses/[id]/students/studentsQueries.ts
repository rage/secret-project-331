import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import { useEffect } from "react"

import type { RegistrationStatusView } from "@/components/credit-registration/registrationStatusViews"
import { registrationStatusesOf } from "@/components/credit-registration/registrationStatusViews"
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
import { includeIf, omitUndefined } from "@/shared-module/common/utils/nullability"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

export type SortDirection = "asc" | "desc"

/** Server sort keys accepted by the identity endpoint. */
export type StudentsSortColumn = "last_name" | "first_name" | "email" | "total_points"

/** Detail subtabs (Completions/Certificates) only render the Student column as sortable. */
export const DETAIL_SORT_COLUMNS: StudentsSortColumn[] = ["last_name"]

/** Progress tab: Student column sorts by last_name, Total points column by the course-wide sum. */
export const PROGRESS_SORT_COLUMNS: StudentsSortColumn[] = ["last_name", "total_points"]

/** Users tab: Student column sorts by last_name, Email column by email. */
export const USERS_SORT_COLUMNS: StudentsSortColumn[] = ["last_name", "email"]

/** One of the sis-0-5 numeric grades, or a pass/fail/no-completion status. */
export type GradeFilterValue =
  | "not_completed"
  | "passed"
  | "failed"
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"

export interface StudentsListParams {
  page: number
  limit: number
  /** Debounced, trimmed search text ("" when empty). */
  search: string
  sortColumn: StudentsSortColumn
  sortDirection: SortDirection
  courseInstanceId: string | null
  /** Module the `grade` filter is scoped to; `grade` is ignored server-side without it. */
  moduleId: string | null
  grade: GradeFilterValue | null
  /** Narrows the page to students holding a live registration at one of the view's stages. */
  registrationView: RegistrationStatusView
}

// Explicit caching opt-in: the global QueryClient sets gcTime ~0, so without these the shared
// identity page and the per-page detail would refetch on every tab switch / remount.
const STALE_TIME = 60_000
const GC_TIME = 5 * 60_000

const IDENTITY_QUERY_ID = "getCourseStudentsUsers"
const DETAIL_KEY_PREFIX = "course-students/"

/**
 * Marks the roster and every subtab's per-page detail stale, for a caller that changed a
 * completion.
 *
 * Matched by predicate rather than by key: the identity query is keyed by every filter and the
 * detail queries by the user ids that happened to be on screen, so no caller can name the keys.
 */
export const invalidateCourseStudents = (courseId: string): Promise<void> =>
  queryClient.invalidateQueries({
    predicate: (query) => {
      const [first, second] = query.queryKey
      if (typeof first === "string") {
        return first.startsWith(DETAIL_KEY_PREFIX) && second === courseId
      }
      return (
        typeof first === "object" &&
        first !== null &&
        (first as { _id?: string })._id === IDENTITY_QUERY_ID
      )
    },
  })

const buildIdentityOptions = (courseId: string, params: StudentsListParams) => {
  const registrationStatuses = registrationStatusesOf(params.registrationView)
  return getCourseStudentsUsersOptions({
    path: { course_id: courseId },
    // Optional keys are omitted (not set to undefined) to satisfy exactOptionalPropertyTypes.
    query: {
      page: params.page,
      limit: params.limit,
      sort_column: params.sortColumn,
      sort_direction: params.sortDirection,
      ...includeIf(params.search, { search: params.search }),
      ...includeIf(params.courseInstanceId, { course_instance_id: params.courseInstanceId }),
      ...omitUndefined({ module_id: params.moduleId ?? undefined }),
      // `grade` is only meaningful alongside a module (enforced server-side too), so it never gets
      // sent on its own.
      ...includeIf(params.moduleId, omitUndefined({ grade: params.grade ?? undefined })),
      ...includeIf(registrationStatuses.length > 0, {
        registration_status: [...registrationStatuses],
      }),
    },
  })
}

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
        moduleId: params.moduleId,
        grade: params.grade,
        registrationView: params.registrationView,
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
    params.moduleId,
    params.grade,
    params.registrationView,
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
        queryKey: [keyPrefix, courseId, ids],
        queryFn: () => fetcher(ids),
        staleTime: STALE_TIME,
        gcTime: GC_TIME,
      }),
  })

export const useCourseStudentsCompletionsDetail = (courseId: string, userIds: string[]) =>
  useQuery(
    userScopedDetailOptions("course-students/completions", courseId, userIds, (ids) =>
      getCourseStudentsCompletions({ path: { course_id: courseId }, body: { user_ids: ids } }),
    ),
  )

export const useCourseStudentsCertificatesDetail = (courseId: string, userIds: string[]) =>
  useQuery(
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
