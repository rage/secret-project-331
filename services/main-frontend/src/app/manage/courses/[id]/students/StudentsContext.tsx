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

import type { SortDirection, StudentsListParams, StudentsSortColumn } from "./studentsQueries"

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
  } = useUrlSyncedDebouncedQuery({ paramName: SEARCH_PARAM, delayMs: SEARCH_DEBOUNCE_MS })

  const { page, limit, setPage, setLimit } = usePaginationInfo(DEFAULT_LIMIT)

  const [sortColumn, setSortColumn] = React.useState<StudentsSortColumn>(DEFAULT_SORT_COLUMN)
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(DEFAULT_SORT_DIRECTION)
  const [courseInstanceId, setCourseInstanceId] = React.useState<string | null>(null)

  const setSort = useCallback((column: StudentsSortColumn, direction: SortDirection) => {
    setSortColumn(column)
    setSortDirection(direction)
  }, [])

  // Changing any filter or the sort order should return to the first page.
  const filterSignature = `${search}|${courseInstanceId ?? ""}|${sortColumn}|${sortDirection}`
  const previousSignature = useRef(filterSignature)
  useEffect(() => {
    if (previousSignature.current === filterSignature) {
      return
    }
    previousSignature.current = filterSignature
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
    page,
    limit,
    setPage,
    setLimit,
    sortColumn,
    sortDirection,
    setSort,
    courseInstanceId,
    setCourseInstanceId,
  }

  return <StudentsContext.Provider value={value}>{children}</StudentsContext.Provider>
}

/** Collects the shared query params that key the identity query. */
export function useStudentsListParams(): StudentsListParams {
  const { page, limit, search, sortColumn, sortDirection, courseInstanceId } = useStudentsContext()
  return { page, limit, search, sortColumn, sortDirection, courseInstanceId }
}

/**
 * Bridges the shared identity sort state to TanStack Table's controlled-sorting API. Column ids are
 * the server sort keys, so toggling a sortable header updates the identity query directly.
 *
 * `allowedColumns` lists the sort keys the calling tab actually renders as sortable columns. Detail
 * tabs only render the Student column, so if the shared sort still points at a Users-only column
 * (first_name / email) it is normalized to the tab's first allowed column. Without this the header
 * shows no active sort and clicking it silently jumps to a different column.
 */
export function useStudentsSorting(allowedColumns: StudentsSortColumn[] = ALL_SORT_COLUMNS): {
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
} {
  const { sortColumn, sortDirection, setSort } = useStudentsContext()
  const columnAllowed = allowedColumns.includes(sortColumn)
  // allowedColumns is always non-empty; fall back to the default sort key if it somehow is not.
  const primaryColumn: StudentsSortColumn = allowedColumns[0] ?? DEFAULT_SORT_COLUMN
  useEffect(() => {
    if (!columnAllowed) {
      setSort(primaryColumn, sortDirection)
    }
  }, [columnAllowed, primaryColumn, sortDirection, setSort])
  const effectiveColumn = columnAllowed ? sortColumn : primaryColumn
  const sorting: SortingState = [{ id: effectiveColumn, desc: sortDirection === "desc" }]
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
