"use client"

import type { OnChangeFn, SortingState } from "@tanstack/react-table"
import type { ReadonlyURLSearchParams } from "next/navigation"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import React, {
  createContext,
  type Dispatch,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react"

import type { RegistrationStatusView } from "@/components/credit-registration/registrationStatusViews"
import {
  DEFAULT_REGISTRATION_STATUS_VIEW,
  REGISTRATION_STATUS_VIEWS,
} from "@/components/credit-registration/registrationStatusViews"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import useUrlSyncedDebouncedQuery from "@/shared-module/common/hooks/useUrlSyncedDebouncedQuery"

import type {
  GradeFilterValue,
  SortDirection,
  StudentsListParams,
  StudentsSortColumn,
} from "./studentsQueries"

const SEARCH_PARAM = "search"
const PAGE_PARAM = "page"

/**
 * The filters that live in the query string.
 *
 * Shareable and linkable is the point: a count in the summary above the roster, a link from the
 * modules page and a redirect from a course instance all arrive as one of these.
 */
export const INSTANCE_PARAM = "instance"
export const MODULE_PARAM = "module"
export const GRADE_PARAM = "grade"
export const REGISTRATION_PARAM = "registration"
const SEARCH_DEBOUNCE_MS = 300
const DEFAULT_SORT_COLUMN: StudentsSortColumn = "last_name"
const DEFAULT_SORT_DIRECTION: SortDirection = "asc"
const DEFAULT_LIMIT = 100
const ALL_SORT_COLUMNS: StudentsSortColumn[] = ["last_name", "first_name", "email"]

interface StudentsContextValue {
  courseId: string
  // Search (URL-synced + debounced).
  searchInput: string
  setSearchInput: Dispatch<SetStateAction<string>>
  search: string
  runImmediateSearch: () => void
  isSearchPending: boolean
  // Pagination (URL-synced).
  page: number
  limit: number
  setPage: (value: number) => void
  setLimit: (value: number) => void
  // Sorting (identity columns only).
  sortColumn: StudentsSortColumn
  sortDirection: SortDirection
  setSort: (column: StudentsSortColumn, direction: SortDirection) => void
  // Course-instance filter.
  courseInstanceId: string | null
  setCourseInstanceId: (value: string | null) => void
  // Grade filter, scoped to a module.
  moduleId: string | null
  setModuleId: (value: string | null) => void
  grade: GradeFilterValue | null
  setGrade: (value: GradeFilterValue | null) => void
  // Credit-registration filter, applied by the server to the shared identity query.
  registrationView: RegistrationStatusView
  setRegistrationView: (value: RegistrationStatusView) => void
}

const StudentsContext = createContext<StudentsContextValue | null>(null)

export function useStudentsContext() {
  const ctx = useContext(StudentsContext)
  if (!ctx) {
    throw new Error("useStudentsContext must be used within StudentsLayout")
  }
  return ctx
}

const isRegistrationStatusView = (value: string | null): value is RegistrationStatusView =>
  value !== null && (REGISTRATION_STATUS_VIEWS as string[]).includes(value)

/**
 * The filter query string, and one writer for it.
 *
 * Writes several parameters at once because they move together — picking a module drops the grade,
 * and every filter change drops the page, which would otherwise ask for a page the narrowed list
 * no longer has.
 */
const useUrlFilters = (): {
  params: ReadonlyURLSearchParams
  setParams: (patch: Record<string, string | null>) => void
} => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const query = searchParams.toString()

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(query)
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") {
          next.delete(key)
        } else {
          next.set(key, value)
        }
      }
      next.delete(PAGE_PARAM)
      const nextQuery = next.toString()
      if (nextQuery === query) {
        return
      }
      router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ""}`)
    },
    [pathname, query, router],
  )

  return { params: searchParams, setParams }
}

export function StudentsContextProvider({
  courseId,
  children,
}: {
  courseId: string
  children: React.ReactNode
}) {
  const {
    inputValue: searchInput,
    setInputValue: setSearchInput,
    queryValue: search,
    runImmediate: runImmediateSearch,
    isPending: isSearchPending,
  } = useUrlSyncedDebouncedQuery({ paramName: SEARCH_PARAM, delayMs: SEARCH_DEBOUNCE_MS })

  const { page, limit, setPage, setLimit } = usePaginationInfo(DEFAULT_LIMIT)

  const [sortColumn, setSortColumn] = React.useState<StudentsSortColumn>(DEFAULT_SORT_COLUMN)
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(DEFAULT_SORT_DIRECTION)
  const { params: filterParams, setParams: setFilterParams } = useUrlFilters()

  const courseInstanceId = filterParams.get(INSTANCE_PARAM)
  const moduleId = filterParams.get(MODULE_PARAM)
  const grade = filterParams.get(GRADE_PARAM) as GradeFilterValue | null
  const registrationViewParam = filterParams.get(REGISTRATION_PARAM)
  const registrationView = isRegistrationStatusView(registrationViewParam)
    ? registrationViewParam
    : DEFAULT_REGISTRATION_STATUS_VIEW

  const setSort = useCallback((column: StudentsSortColumn, direction: SortDirection) => {
    setSortColumn(column)
    setSortDirection(direction)
  }, [])

  const setCourseInstanceId = useCallback(
    (value: string | null) => setFilterParams({ [INSTANCE_PARAM]: value }),
    [setFilterParams],
  )
  // Switching modules invalidates the previously chosen grade (a grade string from one module's
  // scale, e.g. a numeric "3", is not meaningful against another module or against no module).
  const setModuleId = useCallback(
    (value: string | null) => setFilterParams({ [MODULE_PARAM]: value, [GRADE_PARAM]: null }),
    [setFilterParams],
  )
  const setGrade = useCallback(
    (value: GradeFilterValue | null) => setFilterParams({ [GRADE_PARAM]: value }),
    [setFilterParams],
  )
  const setRegistrationView = useCallback(
    (value: RegistrationStatusView) =>
      setFilterParams({
        [REGISTRATION_PARAM]: value === DEFAULT_REGISTRATION_STATUS_VIEW ? null : value,
      }),
    [setFilterParams],
  )

  // Changing any filter or the sort order should return to the first page.
  const filterSignature = `${search}|${courseInstanceId ?? ""}|${moduleId ?? ""}|${grade ?? ""}|${registrationView}|${sortColumn}|${sortDirection}`
  const previousSignature = useRef(filterSignature)
  useEffect(() => {
    if (previousSignature.current === filterSignature) {
      return
    }
    previousSignature.current = filterSignature
    // Reset urgently, together with the filter change, so the identity query never fires for the
    // old page against the new filter (which would flash an empty page before snapping back).
    if (page !== 1) {
      setPage(1)
    }
  }, [filterSignature, page, setPage])

  const value: StudentsContextValue = {
    courseId,
    searchInput,
    setSearchInput,
    search,
    runImmediateSearch,
    isSearchPending,
    page,
    limit,
    setPage,
    setLimit,
    sortColumn,
    sortDirection,
    setSort,
    courseInstanceId,
    setCourseInstanceId,
    moduleId,
    setModuleId,
    grade,
    setGrade,
    registrationView,
    setRegistrationView,
  }

  return <StudentsContext.Provider value={value}>{children}</StudentsContext.Provider>
}

/**
 * Collects the shared query params that key the identity query.
 *
 * `allowedColumns`, when given, scopes the sort sent to the server to columns this caller's table
 * actually renders as sortable: the shared sort state can point at a column from another subtab
 * (e.g. Progress's `total_points`), which would otherwise silently sort this caller's page without
 * a matching header indicator. Falls back to the default sort in that case.
 */
export function useStudentsListParams(allowedColumns?: StudentsSortColumn[]): StudentsListParams {
  const {
    page,
    limit,
    search,
    sortColumn,
    sortDirection,
    courseInstanceId,
    moduleId,
    grade,
    registrationView,
  } = useStudentsContext()
  const columnAllowed = !allowedColumns || allowedColumns.includes(sortColumn)
  return {
    page,
    limit,
    search,
    sortColumn: columnAllowed ? sortColumn : DEFAULT_SORT_COLUMN,
    sortDirection: columnAllowed ? sortDirection : DEFAULT_SORT_DIRECTION,
    courseInstanceId,
    moduleId,
    grade,
    registrationView,
  }
}

/**
 * Bridges the shared identity sort state to TanStack Table's controlled-sorting API; column ids are
 * the server sort keys.
 *
 * `allowedColumns` are the sort keys this tab renders as sortable. When the shared sort points at a
 * column this tab does not render (e.g. a detail tab where only Student is sortable), the header shows
 * no active-sort indicator instead of mutating the shared state — so switching tabs never clobbers
 * another tab's chosen sort or resets its page.
 */
export function useStudentsSorting(allowedColumns: StudentsSortColumn[] = ALL_SORT_COLUMNS): {
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
} {
  const { sortColumn, sortDirection, setSort } = useStudentsContext()
  const columnAllowed = allowedColumns.includes(sortColumn)
  const sorting: SortingState = columnAllowed
    ? [{ id: sortColumn, desc: sortDirection === "desc" }]
    : []
  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === "function" ? updater(sorting) : updater
    const first = next[0]
    if (!first) {
      return
    }
    // oxlint-disable-next-line i18next/no-literal-string
    setSort(first.id as StudentsSortColumn, first.desc ? "desc" : "asc")
  }
  return { sorting, onSortingChange }
}
