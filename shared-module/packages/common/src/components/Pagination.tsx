"use client"

import type { FC } from "react"

import { Pagination as PaginationControl } from "@/shared-module/components/components/Pagination"

import type { PaginationInfo } from "../hooks/usePaginationInfo"
import { omitUndefined } from "../utils/nullability"

/**
 * What the items-per-page control offered these callers before the pager absorbed it. Kept here
 * rather than in the pager, whose own default is sized for new UI: a roster someone used to read a
 * thousand rows of at a time can still be read that way.
 */
const LEGACY_ITEMS_PER_PAGE_OPTIONS = [100, 1000, 10000]

interface PaginationProps {
  paginationInfo: PaginationInfo
  /** Renders nothing below 2 — one page, or none at all, needs no pager. */
  totalPages: number
  disableItemsPerPage?: boolean
  /** Defaults to the sizes these callers have always had, not to the pager's own. */
  itemsPerPageOptions?: number[]
  /** Rows across every page. Without it the readout falls back to "Page 2 of 5". */
  totalItems?: number
}

/**
 * `usePaginationInfo` adapter for the pager in `@/shared-module/components`. New UI should reach
 * for that one directly and hold its own paging state; this exists for the callers already wired
 * to the hook.
 */
const Pagination: FC<PaginationProps> = ({
  paginationInfo,
  totalPages,
  disableItemsPerPage = false,
  itemsPerPageOptions,
  totalItems,
}) => (
  <PaginationControl
    itemsPerPage={paginationInfo.limit}
    onPageChange={paginationInfo.setPage}
    page={paginationInfo.page}
    totalPages={totalPages}
    itemsPerPageOptions={itemsPerPageOptions ?? LEGACY_ITEMS_PER_PAGE_OPTIONS}
    {...omitUndefined({
      totalItems,
      onItemsPerPageChange: disableItemsPerPage ? undefined : paginationInfo.setLimit,
    })}
  />
)

export default Pagination
