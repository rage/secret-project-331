"use client"

import { css, cx } from "@emotion/css"
import { useAtomValue } from "jotai"
import { useRef } from "react"
import { useBreadcrumbItem, useBreadcrumbs } from "react-aria"

import { breadcrumbCrumbsAtom, type Crumb } from "./breadcrumbAtoms"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"

const MARKER = "›"
const ARIA_LABEL_BREADCRUMB = "Breadcrumb"
const ARIA_LABEL_LOADING = "Loading"
const ARIA_CURRENT_PAGE = "page"

function BreadcrumbItem({ crumb, isCurrent }: { crumb: Crumb; isCurrent: boolean }) {
  const ref = useRef<HTMLAnchorElement>(null)
  const label = crumb.isLoading ? "" : crumb.label
  const href = crumb.isLoading ? undefined : (crumb.href ?? undefined)
  const { itemProps } = useBreadcrumbItem({ children: label, isCurrent, href }, ref)

  if (crumb.isLoading) {
    return (
      <li className={breadcrumbItem}>
        <span className={cx(breadcrumbText, skeletonLoader)} aria-label={ARIA_LABEL_LOADING} />
        {!isCurrent && (
          <span className={breadcrumbArrow} aria-hidden="true">
            {MARKER}
          </span>
        )}
      </li>
    )
  }

  const isLink = !isCurrent && crumb.href != null

  return (
    <li className={breadcrumbItem}>
      {isLink ? (
        <a
          {...itemProps}
          ref={ref}
          href={crumb.href}
          className={cx(breadcrumbText, breadcrumbLink)}
        >
          {crumb.label}
        </a>
      ) : (
        <span
          className={cx(breadcrumbText, currentPage)}
          {...(isCurrent ? { "aria-current": ARIA_CURRENT_PAGE } : {})}
        >
          {crumb.label}
        </span>
      )}
      {!isCurrent && (
        <span className={breadcrumbArrow} aria-hidden="true">
          {MARKER}
        </span>
      )}
    </li>
  )
}

export default function BreadcrumbRenderer() {
  const items = useAtomValue(breadcrumbCrumbsAtom)
  const { navProps } = useBreadcrumbs({ "aria-label": ARIA_LABEL_BREADCRUMB })

  if (!items.length) {
    return null
  }

  return (
    <BreakFromCentered sidebar={false}>
      <div className={wrapper}>
        <nav {...navProps} className={breadcrumbNav}>
          <ol className={breadcrumbList}>
            {items.map((item, idx) => (
              <BreadcrumbItem
                key={`${item.entryKey}-${item.index}`}
                crumb={item.crumb}
                isCurrent={idx === items.length - 1}
              />
            ))}
          </ol>
        </nav>
      </div>
    </BreakFromCentered>
  )
}

const wrapper = css`
  padding: 1rem 2rem;
  color: #fff;
  border-radius: 2px;

  &:nth-of-type(n + 2) {
    margin-top: 2.5rem;
  }
`

const breadcrumbNav = css`
  font-size: 16px;
`

const breadcrumbList = css`
  margin: 0.5rem 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding-left: 0;
  list-style: none;

  @media (min-width: 768px) {
    padding-left: 2rem;
  }
`

const breadcrumbItem = css`
  display: inline-flex;
  align-items: center;
`

const breadcrumbText = css`
  font-size: 16px;
`

const breadcrumbLink = css`
  color: #696e77;
  text-decoration: none !important;
  cursor: pointer;

  &:hover {
    color: #1a2333;
  }
`

const currentPage = css`
  color: #1a2333;
  font-weight: bold;
`

const breadcrumbArrow = css`
  margin-left: 0.75rem;
  color: #333;
`

const skeletonLoader = css`
  display: inline-block;
  width: 80px;
  height: 16px;
  background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
`
