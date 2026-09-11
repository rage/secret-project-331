"use client"

import type { FC } from "react"

import { Pagination as PaginationControl } from "@/shared-module/components/components/Pagination"

import type { PaginationInfo } from "../hooks/usePaginationInfo"
import { omitUndefined } from "../utils/nullability"

interface PaginationProps {
  paginationInfo: PaginationInfo
  /** Renders nothing below 2 — one page, or none at all, needs no pager. */
  totalPages: number
  disableItemsPerPage?: boolean
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
    {...omitUndefined({
      totalItems,
      itemsPerPageOptions,
      onItemsPerPageChange: disableItemsPerPage ? undefined : paginationInfo.setLimit,
    })}
  />
)

export default Pagination
