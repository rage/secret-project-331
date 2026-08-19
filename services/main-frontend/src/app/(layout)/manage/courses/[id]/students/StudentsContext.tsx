"use client"

import type { OnChangeFn, SortingState } from "@tanstack/react-table"
import React, {
  createContext,
  type Dispatch,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react"

import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import useUrlSyncedDebouncedQuery from "@/shared-module/common/hooks/useUrlSyncedDebouncedQuery"

import type {
  GradeFilterValue,
  SortDirection,
  StudentsListParams,
  StudentsSortColumn,
} from "./studentsQueries"

const SEARCH_PARAM = "search"
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
}

const StudentsContext = createContext<StudentsContextValue | null>(null)

export function useStudentsContext() {
  const ctx = useContext(StudentsContext)
  if (!ctx) {
    throw new Error("useStudentsContext must be used within StudentsLayout")
  }
  return ctx
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
  const [courseInstanceId, setCourseInstanceId] = React.useState<string | null>(null)
  const [moduleId, setModuleIdState] = React.useState<string | null>(null)
  const [grade, setGrade] = React.useState<GradeFilterValue | null>(null)

  const setSort = useCallback((column: StudentsSortColumn, direction: SortDirection) => {
    setSortColumn(column)
    setSortDirection(direction)
  }, [])

  // Switching modules invalidates the previously chosen grade (a grade string from one module's
  // scale, e.g. a numeric "3", is not meaningful against another module or against no module).
  const setModuleId = useCallback((value: string | null) => {
    setModuleIdState(value)
    setGrade(null)
  }, [])

  // Changing any filter or the sort order should return to the first page.
  const filterSignature = `${search}|${courseInstanceId ?? ""}|${moduleId ?? ""}|${grade ?? ""}|${sortColumn}|${sortDirection}`
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
  const { page, limit, search, sortColumn, sortDirection, courseInstanceId, moduleId, grade } =
    useStudentsContext()
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
