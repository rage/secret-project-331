"use client"

import { css, cx } from "@emotion/css"
import { DotsHorizontal } from "@vectopus/atlas-icons-react"
import { useEffect, useMemo, useRef } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { ChevronIcon } from "./primitives/ChevronIcon"
import { Select, type SelectOption } from "./Select"

/**
 * Page sizes the items-per-page control offers unless the caller names its own. Nothing above a
 * few hundred rows belongs here: a big limit is a slow query and a page nobody can read.
 */
const DEFAULT_ITEMS_PER_PAGE_OPTIONS: readonly number[] = [25, 50, 100]

/** Page buttons shown before the list collapses to first / window around current / last. */
const MAX_PAGE_BUTTONS = 7

/** A page number, or `null` for the gap standing in for a dropped run of pages. */
type PageSlot = number | null

const CHEVRON_LEFT = "left" as const
const CHEVRON_RIGHT = "right" as const
const ITEMS_PER_PAGE_FIELD_SIZE = "sm" as const

interface ItemsPerPageForm {
  itemsPerPage: string
}

const rootCss = css`
  --pagination-item-size: 36px;

  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3) var(--space-4);
  margin: var(--space-4) 0;

  @media (min-width: 600px) {
    --pagination-item-size: 44px;
  }
`

const readoutCss = css`
  margin: 0;
  flex: 1 1 auto;
  min-width: 0;
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
  font-variant-numeric: tabular-nums;
`

const pageListCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
`

const listItemCss = css`
  display: inline-flex;
  flex: none;
`

const slotCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: var(--pagination-item-size);
  height: var(--pagination-item-size);
`

const buttonCss = css`
  padding: 0;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--color-gray-600);
  font: inherit;
  font-size: var(--font-size-2);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;

  &:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 var(--focus-ring-offset) var(--focus-ring-offset-color),
      0 0 0 calc(var(--focus-ring-offset) + var(--focus-ring-width)) var(--focus-ring-color);
  }

  &:disabled {
    color: var(--color-gray-300);
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background: var(--color-clear-200);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const currentButtonCss = css`
  background: var(--color-gray-700);
  border-color: var(--color-gray-700);
  color: var(--color-primary-100);
  font-weight: 600;

  &:hover:not(:disabled) {
    background: var(--color-gray-700);
  }
`

const gapCss = css`
  color: var(--color-gray-400);
`

const itemsPerPageCss = css`
  flex: none;
  width: 9rem;
`

/**
 * The slots between the previous and next buttons: every page when they all fit, otherwise the
 * first page, the pages around `page`, the last page, and a `null` gap wherever a run was dropped.
 */
function buildPageSlots(page: number, totalPages: number): PageSlot[] {
  if (totalPages <= MAX_PAGE_BUTTONS) {
    return Array.from({ length: totalPages }, (_unused, index) => index + 1)
  }

  const windowStart = Math.max(2, Math.min(page - 1, totalPages - 3))
  const windowEnd = Math.min(totalPages - 1, Math.max(page + 1, 4))

  const slots: PageSlot[] = [1]
  if (windowStart > 2) {
    slots.push(null)
  }
  for (let candidate = windowStart; candidate <= windowEnd; candidate++) {
    slots.push(candidate)
  }
  if (windowEnd < totalPages - 1) {
    slots.push(null)
  }
  slots.push(totalPages)
  return slots
}

export interface PaginationProps {
  /** The page being shown, counting from 1. A value outside the range is clamped. */
  page: number
  /** Renders nothing below 2 — one page, or none at all, needs no pager. */
  totalPages: number
  onPageChange: (page: number) => void
  /** Rows on one page. Feeds both the range readout and the items-per-page control. */
  itemsPerPage: number
  /** Rows across every page. Without it the readout falls back to "Page 2 of 5". */
  totalItems?: number
  /** Leave out to drop the items-per-page control, for a caller whose page size is fixed. */
  onItemsPerPageChange?: (itemsPerPage: number) => void
  /** Page sizes to offer. `itemsPerPage` joins the list when it is not already one of them. */
  itemsPerPageOptions?: readonly number[]
  className?: string
}

/**
 * Page navigation for a list that arrives one page at a time: a range readout, previous/next, a
 * compact page list, and the page-size control on the same row.
 *
 * Paging state stays with the caller — `page` and `itemsPerPage` say what is on screen, the two
 * callbacks say what the reader asked for next.
 */
export function Pagination({
  page,
  totalPages,
  onPageChange,
  itemsPerPage,
  totalItems,
  onItemsPerPageChange,
  itemsPerPageOptions,
  className,
}: PaginationProps) {
  const { t } = useTranslation("shared-module")

  const form = useForm<ItemsPerPageForm>({
    defaultValues: { itemsPerPage: String(itemsPerPage) },
  })
  const { itemsPerPage: pickedItemsPerPage } = form.watch()
  const reportedItemsPerPage = useRef(itemsPerPage)

  // The caller owns the page size, usually through the query string, so its value has to win over
  // the field whenever it changes underneath us: a Back button, or a caller-side reset.
  useEffect(() => {
    reportedItemsPerPage.current = itemsPerPage
    form.reset({ itemsPerPage: String(itemsPerPage) })
  }, [form, itemsPerPage])

  // Callers hand us a fresh `onItemsPerPageChange` every render, so the ref — not `itemsPerPage` —
  // is what keeps a re-run from asking for the same size twice before the caller's state settles.
  useEffect(() => {
    const picked = Number(pickedItemsPerPage)
    if (!Number.isFinite(picked) || picked <= 0 || picked === reportedItemsPerPage.current) {
      return
    }
    reportedItemsPerPage.current = picked
    onItemsPerPageChange?.(picked)
  }, [onItemsPerPageChange, pickedItemsPerPage])

  const options = useMemo<SelectOption[]>(() => {
    const offered = [...(itemsPerPageOptions ?? DEFAULT_ITEMS_PER_PAGE_OPTIONS)]
    // A hand-edited `limit` in the URL is a supported way in, so keep whatever it asked for.
    if (!offered.includes(itemsPerPage)) {
      offered.push(itemsPerPage)
    }
    return offered
      .toSorted((first, second) => first - second)
      .map((size) => ({ value: String(size), label: String(size) }))
  }, [itemsPerPage, itemsPerPageOptions])

  const currentPage = Math.min(Math.max(page, 1), Math.max(totalPages, 1))
  const slots = useMemo(() => buildPageSlots(currentPage, totalPages), [currentPage, totalPages])

  if (totalPages < 2) {
    return null
  }

  const readout =
    totalItems === undefined
      ? t("pagination.pageOfTotal", { page: currentPage, totalPages })
      : t("pagination.range", {
          first: (currentPage - 1) * itemsPerPage + 1,
          last: Math.min(currentPage * itemsPerPage, totalItems),
          total: totalItems,
        })

  return (
    <nav aria-label={t("pagination.label")} className={cx(rootCss, className)}>
      <p className={readoutCss}>{readout}</p>

      <ul className={pageListCss}>
        <li className={listItemCss}>
          <button
            aria-label={t("go-to-previous-page")}
            className={cx(slotCss, buttonCss)}
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            type="button"
          >
            <ChevronIcon direction={CHEVRON_LEFT} />
          </button>
        </li>

        {slots.map((slot, slotIndex) =>
          slot === null ? (
            <li
              aria-hidden="true"
              className={cx(listItemCss, slotCss, gapCss)}
              key={`gap-${slotIndex}`}
            >
              <DotsHorizontal size={16} weight="bold" />
            </li>
          ) : (
            <li className={listItemCss} key={slot}>
              <button
                aria-current={slot === currentPage ? "page" : undefined}
                aria-label={
                  slot === currentPage
                    ? t("current-page-x", { number: slot })
                    : t("go-to-page-x", { number: slot })
                }
                className={cx(slotCss, buttonCss, slot === currentPage && currentButtonCss)}
                onClick={() => onPageChange(slot)}
                type="button"
              >
                {slot}
              </button>
            </li>
          ),
        )}

        <li className={listItemCss}>
          <button
            aria-label={t("go-to-next-page")}
            className={cx(slotCss, buttonCss)}
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            type="button"
          >
            <ChevronIcon direction={CHEVRON_RIGHT} />
          </button>
        </li>
      </ul>

      {onItemsPerPageChange === undefined ? null : (
        <Select
          className={itemsPerPageCss}
          control={form.control}
          fieldSize={ITEMS_PER_PAGE_FIELD_SIZE}
          label={t("label-items-per-page")}
          name="itemsPerPage"
          options={options}
        />
      )}
    </nav>
  )
}
