"use client"

import { cx } from "@emotion/css"
import { ArrowLeft, ArrowRight } from "@vectopus/atlas-icons-react"
import React from "react"
import {
  mergeProps,
  useButton,
  useFocusRing,
  useLocale,
  useNumberFormatter,
  useObjectRef,
  VisuallyHidden,
} from "react-aria"
import { useTranslation } from "react-i18next"

import { includeIf } from "../lib/utils/nullability"
import {
  compactStatusCss,
  ellipsisCss,
  iconCss,
  navCss,
  numberedItemCss,
  pageButtonCss,
  pageListCss,
} from "./paginationStyles"

export interface PaginationProps {
  /** 1-based. A value outside `[1, totalPages]` is clamped for rendering; the caller is not corrected. */
  page: number
  /** Rounded up and floored at 1. The pager renders nothing when `<= 1`. */
  totalPages: number
  onPageChange: (page: number) => void
  /** Names the `<nav>` landmark. Defaults to `t("pagination.label")`. */
  label?: string
  /** Greys out every control without removing the landmark, e.g. while the pager's data refetches. */
  isDisabled?: boolean
  className?: string
  "data-testid"?: string | undefined
}

/** `null` marks an ellipsis slot; it carries no page number to translate or format. */
type PageItem = number | null

const BOUNDARY_COUNT = 1
const SIBLING_COUNT = 2
const ELLIPSIS_GLYPH = "…"
const ARIA_CURRENT_PAGE = "page" as const

const REPAIR_DIRECTION = {
  PREV: "prev",
  NEXT: "next",
} as const
type RepairDirection = (typeof REPAIR_DIRECTION)[keyof typeof REPAIR_DIRECTION]

function range(start: number, end: number): number[] {
  if (end < start) {
    return []
  }
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
}

/**
 * Pages to show around `current`, always summing to `min(total, 2 * BOUNDARY_COUNT + 2 *
 * SIBLING_COUNT + 3)` slots so the pager's width never changes as the user pages through it.
 * A gap of exactly one page renders as that page number rather than an ellipsis.
 */
function computePageItems(current: number, total: number): PageItem[] {
  const startPages = range(1, Math.min(BOUNDARY_COUNT, total))
  const endPages = range(Math.max(total - BOUNDARY_COUNT + 1, BOUNDARY_COUNT + 1), total)

  const siblingsStart = Math.max(
    Math.min(current - SIBLING_COUNT, total - BOUNDARY_COUNT - SIBLING_COUNT * 2 - 1),
    BOUNDARY_COUNT + 2,
  )
  const firstEndPage = endPages[0]
  const siblingsEnd = Math.min(
    Math.max(current + SIBLING_COUNT, BOUNDARY_COUNT + SIBLING_COUNT * 2 + 2),
    firstEndPage !== undefined ? firstEndPage - 2 : total - 1,
  )

  const items: PageItem[] = [...startPages]

  if (siblingsStart > BOUNDARY_COUNT + 2) {
    items.push(null)
  } else if (BOUNDARY_COUNT + 1 < total - BOUNDARY_COUNT) {
    items.push(BOUNDARY_COUNT + 1)
  }

  items.push(...range(siblingsStart, siblingsEnd))

  if (siblingsEnd < total - BOUNDARY_COUNT - 1) {
    items.push(null)
  } else if (total - BOUNDARY_COUNT > BOUNDARY_COUNT) {
    items.push(total - BOUNDARY_COUNT)
  }

  items.push(...endPages)

  return items
}

// display:none elements stay in the DOM (compact vs. full is CSS-only) but browsers refuse
// them focus, so a fallback candidate must be checked before .focus() is trusted to have worked.
function isRenderedForFocus(element: HTMLElement | null): element is HTMLElement {
  return element !== null && getComputedStyle(element).display !== "none"
}

interface PagerButtonProps {
  ariaLabel: string
  isCurrent?: boolean
  isDisabled: boolean
  onPress: () => void
  children: React.ReactNode
}

const PagerButton = React.forwardRef<HTMLButtonElement, PagerButtonProps>(function PagerButton(
  { ariaLabel, isCurrent = false, isDisabled, onPress, children },
  forwardedRef,
) {
  const ref = useObjectRef(forwardedRef)
  const { buttonProps } = useButton(
    {
      isDisabled,
      onPress,
      "aria-label": ariaLabel,
      ...includeIf(isCurrent, { "aria-current": ARIA_CURRENT_PAGE }),
    },
    ref,
  )
  const { focusProps, isFocusVisible } = useFocusRing()

  return (
    <button
      {...mergeProps(buttonProps, focusProps)}
      ref={ref}
      className={pageButtonCss}
      data-focus-visible={isFocusVisible ? "true" : "false"}
    >
      {children}
    </button>
  )
})

/**
 * A `<nav>` of page controls for a list or table: disabled boundaries, `aria-current` on the
 * current page, and a polite live-region announcement on every page change after the first.
 * Renders nothing when `totalPages <= 1`.
 */
export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  onPageChange,
  label,
  isDisabled = false,
  className,
  "data-testid": dataTestId,
}) => {
  const { t } = useTranslation("shared-module")
  const { direction } = useLocale()
  const formatNumber = useNumberFormatter()

  const normalizedTotalPages = Math.max(1, Math.ceil(totalPages))
  const clampedPage = Math.min(Math.max(1, page), normalizedTotalPages)

  const navRef = React.useRef<HTMLElement>(null)
  const prevButtonRef = React.useRef<HTMLButtonElement>(null)
  const nextButtonRef = React.useRef<HTMLButtonElement>(null)
  const currentPageButtonRef = React.useRef<HTMLButtonElement>(null)
  const pendingFocusRepairRef = React.useRef<RepairDirection | null>(null)
  const hasAnnouncedRef = React.useRef(false)
  const statusId = React.useId()

  const [liveMessage, setLiveMessage] = React.useState("")

  const statusText = t("pagination.pageOfTotal", {
    page: formatNumber.format(clampedPage),
    total: formatNumber.format(normalizedTotalPages),
  })

  // Stays empty on mount so a page loaded at "page 1" doesn't announce itself; only a real
  // page change (parent re-renders with a new page/totalPages) triggers the live region.
  React.useEffect(() => {
    if (!hasAnnouncedRef.current) {
      hasAnnouncedRef.current = true
      return
    }
    setLiveMessage(statusText)
  }, [clampedPage, normalizedTotalPages, statusText])

  React.useEffect(() => {
    const repairDirection = pendingFocusRepairRef.current
    if (!repairDirection) {
      return
    }
    pendingFocusRepairRef.current = null

    const pressedButton =
      repairDirection === REPAIR_DIRECTION.PREV ? prevButtonRef.current : nextButtonRef.current
    if (!pressedButton?.disabled) {
      // The press didn't reach the boundary after all (e.g. the caller ignored onPageChange).
      return
    }

    const currentButton = currentPageButtonRef.current
    if (isRenderedForFocus(currentButton)) {
      currentButton.focus()
      return
    }
    const fallbackButton =
      repairDirection === REPAIR_DIRECTION.PREV ? nextButtonRef.current : prevButtonRef.current
    if (isRenderedForFocus(fallbackButton)) {
      fallbackButton.focus()
      return
    }
    navRef.current?.focus()
  })

  if (normalizedTotalPages <= 1) {
    return null
  }

  const goToPage = (target: number) => {
    if (target !== clampedPage) {
      onPageChange(target)
    }
  }

  const handlePrevPress = () => {
    const target = clampedPage - 1
    if (target === 1 && document.activeElement === prevButtonRef.current) {
      pendingFocusRepairRef.current = REPAIR_DIRECTION.PREV
    }
    goToPage(target)
  }

  const handleNextPress = () => {
    const target = clampedPage + 1
    if (target === normalizedTotalPages && document.activeElement === nextButtonRef.current) {
      pendingFocusRepairRef.current = REPAIR_DIRECTION.NEXT
    }
    goToPage(target)
  }

  const PrevIcon = direction === "rtl" ? ArrowRight : ArrowLeft
  const NextIcon = direction === "rtl" ? ArrowLeft : ArrowRight

  const items = computePageItems(clampedPage, normalizedTotalPages)

  return (
    <nav
      ref={navRef}
      tabIndex={-1}
      aria-label={label ?? t("pagination.label")}
      aria-describedby={statusId}
      className={cx(navCss, className)}
      data-testid={dataTestId}
    >
      <ul className={pageListCss}>
        <li>
          <PagerButton
            ref={prevButtonRef}
            ariaLabel={t("pagination.previousPage")}
            isDisabled={isDisabled || clampedPage <= 1}
            onPress={handlePrevPress}
          >
            <span className={iconCss} aria-hidden="true">
              <PrevIcon size={16} weight="bold" />
            </span>
          </PagerButton>
        </li>

        {items.map((item, index) =>
          item === null ? (
            <li
              key={`ellipsis-${index}`}
              aria-hidden="true"
              className={cx(numberedItemCss, ellipsisCss)}
            >
              {ELLIPSIS_GLYPH}
            </li>
          ) : (
            <li key={item} className={numberedItemCss}>
              <PagerButton
                ref={item === clampedPage ? currentPageButtonRef : undefined}
                ariaLabel={
                  item === clampedPage
                    ? t("pagination.page", { page: formatNumber.format(item) })
                    : t("pagination.goToPage", { page: formatNumber.format(item) })
                }
                isCurrent={item === clampedPage}
                isDisabled={isDisabled}
                onPress={() => goToPage(item)}
              >
                {formatNumber.format(item)}
              </PagerButton>
            </li>
          ),
        )}

        <li>
          <PagerButton
            ref={nextButtonRef}
            ariaLabel={t("pagination.nextPage")}
            isDisabled={isDisabled || clampedPage >= normalizedTotalPages}
            onPress={handleNextPress}
          >
            <span className={iconCss} aria-hidden="true">
              <NextIcon size={16} weight="bold" />
            </span>
          </PagerButton>
        </li>
      </ul>

      <span id={statusId} className={compactStatusCss}>
        {statusText}
      </span>

      <VisuallyHidden role="status" aria-live="polite">
        {liveMessage}
      </VisuallyHidden>
    </nav>
  )
}
