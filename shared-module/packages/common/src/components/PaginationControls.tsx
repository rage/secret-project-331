"use client"

import React from "react"

import type { PaginationProps } from "@/shared-module/components/components/Pagination"
import { Pagination } from "@/shared-module/components/components/Pagination"

import type { PaginationInfo } from "../hooks/usePaginationInfo"
import { omitUndefined } from "../utils/nullability"

export interface PaginationControlsProps extends Pick<
  PaginationProps,
  "label" | "isDisabled" | "className" | "data-testid"
> {
  /** URL-synced page state, e.g. from `usePaginationInfo`. */
  paginationInfo: PaginationInfo
  totalPages: number
}

/**
 * Adapts a `PaginationInfo` bundle (URL-synced page state, coupled to Next.js routing) to
 * `components`' routing-free `Pagination`, so existing call sites can keep passing the bundle
 * they already have.
 */
const PaginationControls: React.FC<PaginationControlsProps> = ({
  paginationInfo,
  totalPages,
  label,
  isDisabled,
  className,
  "data-testid": dataTestId,
}) => (
  <Pagination
    page={paginationInfo.page}
    totalPages={totalPages}
    onPageChange={paginationInfo.setPage}
    {...omitUndefined({ label, isDisabled, className, "data-testid": dataTestId })}
  />
)

export default PaginationControls
