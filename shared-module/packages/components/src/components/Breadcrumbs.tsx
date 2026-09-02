"use client"

import { css, cx, keyframes } from "@emotion/css"
import React, { useEffect, useId } from "react"
import {
  useBreadcrumbItem,
  useBreadcrumbs,
  useLocale,
  useObjectRef,
  VisuallyHidden,
} from "react-aria"
import { useTranslation } from "react-i18next"

import { below } from "../styles/breakpoints"
import { Link } from "./Link"

export type BreadcrumbItem =
  | { status: "pending"; key: React.Key }
  | {
      status?: "ready"
      /** Falls back to the array index. Give a stable one when items can be pending. */
      key?: React.Key
      label: string
      /** Omit for a non-navigable crumb. The last item never renders as a link regardless of this. */
      href?: string
      /** Renders a plain `<a>` instead of the package's `Link`, for navigation leaving this Next app. */
      isExternal?: boolean
    }

export interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  /** Names the nav landmark. Defaults to `t("breadcrumbs.label")`. */
  label?: string
  /** Renders the last item as a heading instead of a span. */
  currentAs?: "span" | "h1" | "h2" | "h3"
  className?: string
  "data-testid"?: string
}

const SEPARATOR_LTR = "›"
const SEPARATOR_RTL = "‹"

const SCROLL_CURRENT_INTO_VIEW_OPTIONS: ScrollIntoViewOptions = { inline: "end", block: "nearest" }

const shimmer = keyframes`
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
`

const navCss = css`
  min-inline-size: 0;
`

const listCss = css`
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
  min-inline-size: 0;
  overflow-x: auto;

  ${below("sm")} {
    scroll-snap-type: inline mandatory;
  }
`

const itemCss = css`
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  flex: none;
  min-block-size: var(--control-height-sm);
  scroll-snap-align: start;
`

const crumbTextCss = css`
  display: inline-block;
  padding-block: var(--space-2);
  min-inline-size: 4ch;
  max-inline-size: 24ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
  font-size: var(--font-size-1);
`

const currentCrumbCss = css`
  max-inline-size: 40ch;
  color: var(--color-gray-800);
  font-weight: 600;
`

const linkCss = css`
  color: var(--color-gray-500);
  text-decoration: none;

  &:hover {
    color: var(--color-gray-800);
    text-decoration: underline;
  }
`

const separatorCss = css`
  flex: none;
  font-size: 12px;
  color: var(--color-gray-400);
`

const pendingCss = css`
  display: inline-block;
  inline-size: 8ch;
  block-size: 1em;
  border-radius: var(--radius-1);
  background: linear-gradient(
    90deg,
    var(--color-clear-200) 25%,
    var(--color-clear-100) 50%,
    var(--color-clear-200) 75%
  );
  background-size: 200% 100%;
  animation: ${shimmer} var(--duration-shimmer) linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    background: var(--color-clear-200);
  }
`

/**
 * Trail of ancestor links to the current page. Wraps react-aria's `useBreadcrumbs`/
 * `useBreadcrumbItem`; feed it a `Crumb[] → BreadcrumbItem[]` mapping from wherever your route
 * hierarchy lives.
 *
 * A `status: "pending"` item renders a placeholder and sets `aria-busy` on the nav once,
 * regardless of how many items are pending. The last item is always the current page: it is
 * never a link even if it carries an `href`, and `currentAs` controls whether it renders as a
 * heading.
 */
export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  label,
  currentAs = "span",
  className,
  "data-testid": dataTestId,
}) => {
  const { t } = useTranslation("shared-module")
  const { direction } = useLocale()
  const { navProps } = useBreadcrumbs({ "aria-label": label ?? t("breadcrumbs.label") })
  const loadingDescId = useId()

  const anyPending = items.some((item) => item.status === "pending")
  const separator = direction === "rtl" ? SEPARATOR_RTL : SEPARATOR_LTR

  return (
    <nav
      {...navProps}
      aria-busy={anyPending ? "true" : undefined}
      aria-describedby={anyPending ? loadingDescId : undefined}
      className={cx(navCss, className)}
      data-testid={dataTestId}
    >
      {/* oxlint-disable-next-line jsx-a11y/no-redundant-roles -- Safari VoiceOver drops list semantics once list-style is removed */}
      <ol className={listCss} role="list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          const isCurrent = isLast && item.status !== "pending"
          const itemKey = item.key ?? index

          return (
            <li key={itemKey} className={itemCss}>
              <CrumbContent item={item} isCurrent={isCurrent} currentAs={currentAs} />
              {!isLast ? (
                <span className={separatorCss} aria-hidden="true">
                  {separator}
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>
      {anyPending ? (
        <VisuallyHidden id={loadingDescId}>{t("breadcrumbs.loading")}</VisuallyHidden>
      ) : null}
    </nav>
  )
}

function CrumbContent({
  item,
  isCurrent,
  currentAs,
}: {
  item: BreadcrumbItem
  isCurrent: boolean
  currentAs: "span" | "h1" | "h2" | "h3"
}) {
  if (item.status === "pending") {
    return <span className={pendingCss} data-pending="true" aria-hidden="true" />
  }

  if (isCurrent) {
    return <CurrentCrumb label={item.label} currentAs={currentAs} />
  }

  if (item.href === undefined) {
    return (
      <span className={crumbTextCss} title={item.label}>
        {item.label}
      </span>
    )
  }

  if (item.isExternal) {
    return (
      <a href={item.href} className={cx(crumbTextCss, linkCss)} title={item.label}>
        {item.label}
      </a>
    )
  }

  return (
    <Link href={item.href} className={cx(crumbTextCss, linkCss)} title={item.label}>
      {item.label}
    </Link>
  )
}

/**
 * The trailing, current-page crumb. Its own `useBreadcrumbItem` call is what supplies
 * `aria-current` and, via `elementType`, the heading branch `currentAs` selects — the reason
 * this is split out from `CrumbContent` rather than sharing a hook call with the link case.
 */
function CurrentCrumb({
  label,
  currentAs,
}: {
  label: string
  currentAs: "span" | "h1" | "h2" | "h3"
}) {
  const ref = useObjectRef<HTMLElement>()
  const { itemProps } = useBreadcrumbItem(
    { children: label, isCurrent: true, elementType: currentAs },
    ref,
  )

  useEffect(() => {
    const node = ref.current
    if (!node || typeof node.scrollIntoView !== "function") {
      return
    }
    node.scrollIntoView(SCROLL_CURRENT_INTO_VIEW_OPTIONS)
  }, [ref])

  return React.createElement(
    currentAs,
    { ...itemProps, ref, className: cx(crumbTextCss, currentCrumbCss), title: label },
    label,
  )
}
