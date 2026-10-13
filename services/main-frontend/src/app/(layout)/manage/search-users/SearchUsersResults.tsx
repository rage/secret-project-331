"use client"

import { css, cx, keyframes } from "@emotion/css"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import React, { useLayoutEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import type { UserDetail } from "@/generated/api/types.generated"
import { manageUserRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import {
  Button,
  EmptyState,
  Infobox,
  Link,
  Table,
  type TableColumn,
  TONE,
} from "@/shared-module/components"
import {
  skeletonBlockBaseCss,
  skeletonBlockDimsCss,
  skeletonBlockLightCss,
} from "@/shared-module/components/components/queryResult/queryResultStyles"

import {
  type ResultRow,
  resultRowKey,
  resultRows,
  resultsView,
  type SearchUsersState,
} from "./searchUsersState"

const STAGGERED_ROW_COUNT = 10
const STAGGER_STEP_MS = 20
const EASE = [0.2, 0, 0, 1] as const
const AUTO_HEIGHT = "auto" as const
const PRESENCE_MODE = "wait" as const
const TABLE_STACK = "stack" as const
const EXACT_GROUP = "exact" as const
const SIMILAR_GROUP = "similar" as const

const rowEntrance = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
`

const rowEntranceCss = css`
  tbody tr {
    animation: ${rowEntrance} 200ms cubic-bezier(0.2, 0, 0, 1) both;
    animation-delay: ${STAGGERED_ROW_COUNT * STAGGER_STEP_MS}ms;
  }
  ${Array.from(
    { length: STAGGERED_ROW_COUNT },
    (_, index) =>
      `tbody tr:nth-child(${index + 1}) { animation-delay: ${index * STAGGER_STEP_MS}ms; }`,
  ).join("\n")}

  @media (prefers-reduced-motion: reduce) {
    tbody tr {
      animation: none;
    }
  }
`

const staleCss = css`
  transition: var(--query-content-transition);
`

const staleDimmedCss = css`
  filter: blur(var(--query-refresh-blur));
  opacity: var(--query-refresh-content-opacity);
  transform: scale(var(--query-refresh-content-scale));
  pointer-events: none;
`

const skeletonCss = cx(skeletonBlockBaseCss, skeletonBlockLightCss, skeletonBlockDimsCss("70%", 12))

const sectionCss = css`
  display: grid;
  gap: var(--space-3);
`

const animatedHeightCss = css`
  overflow: clip;
  overflow-clip-margin: var(--space-1);
`

const summaryCss = css`
  margin: 0;
  color: var(--color-gray-600);
`

/** Follows its content's height with an animation instead of jumping. */
const AnimatedHeight: React.FC<React.PropsWithChildren> = ({ children }) => {
  const shouldReduceMotion = !!useReducedMotion()
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | typeof AUTO_HEIGHT>(AUTO_HEIGHT)

  useLayoutEffect(() => {
    const content = contentRef.current
    if (!content || typeof ResizeObserver === "undefined") {
      return
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setHeight(entry.contentRect.height)
      }
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  return (
    <motion.div
      className={animatedHeightCss}
      animate={{ height }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: EASE }}
    >
      <div ref={contentRef}>{children}</div>
    </motion.div>
  )
}

const skeletonCell = <div className={skeletonCss} />

const userCell = (pick: (user: UserDetail) => React.ReactNode) =>
  function renderUserCell(row: ResultRow): React.ReactNode {
    return row.kind === "user" ? pick(row.user) : skeletonCell
  }

export interface SearchUsersResultsProps {
  state: SearchUsersState
  isTooShort: boolean
  onRetryExact: () => void
  onRetryFuzzy: () => void
}

const SearchUsersResults: React.FC<SearchUsersResultsProps> = ({
  state,
  isTooShort,
  onRetryExact,
  onRetryFuzzy,
}) => {
  const { t } = useTranslation()
  const shouldReduceMotion = !!useReducedMotion()

  const columns = useMemo<TableColumn<ResultRow>[]>(
    () => [
      {
        header: t("label-user-id"),
        width: "24rem",
        nowrap: true,
        cell: userCell((user) => user.user_id),
      },
      { header: t("label-email"), grow: 2, cell: userCell((user) => user.email) },
      { header: t("first-name"), grow: 1, cell: userCell((user) => user.first_name) },
      { header: t("last-name"), grow: 1, cell: userCell((user) => user.last_name) },
      {
        header: t("button-details"),
        width: "7rem",
        cell: (row) =>
          row.kind === "user" ? (
            <Link
              href={manageUserRoute(row.user.user_id)}
              styledAsButton
              variant="tertiary"
              size="small"
            >
              {t("button-details")}
            </Link>
          ) : null,
      },
    ],
    [t],
  )

  const isStale = state.previous !== null
  const rows = resultRows(state)
  const hasExactGroup = rows.some((row) => row.kind === "user" && row.isExact)
  const view = resultsView(state, isTooShort)

  return (
    <AnimatedHeight>
      <AnimatePresence mode={PRESENCE_MODE} initial={false}>
        <motion.div
          key={view}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.18, ease: EASE } }}
          {...(!shouldReduceMotion && {
            exit: { opacity: 0, transition: { duration: 0.12 } },
          })}
        >
          {view === "too-short" && <EmptyState title={t("search-users-too-short")} />}
          {view === "empty" && <EmptyState title={t("search-users-no-users-found")} />}
          {view === "table" && (
            <div className={sectionCss}>
              {state.hasExactFailed ? (
                <Infobox tone={TONE.DANGER}>
                  {t("search-users-exact-failed")}{" "}
                  <Button variant="tertiary" size="small" onClick={onRetryExact}>
                    {t("try-again")}
                  </Button>
                </Infobox>
              ) : null}
              {rows.length > 0 && (
                <div
                  className={cx(staleCss, isStale && staleDimmedCss)}
                  inert={isStale}
                  aria-busy={state.isSearching}
                >
                  <Table
                    className={rowEntranceCss}
                    caption={t("title-user-search")}
                    columns={columns}
                    rows={rows}
                    rowKey={resultRowKey}
                    {...(hasExactGroup && {
                      rowGroup: (row: ResultRow) =>
                        row.kind === "user" && row.isExact
                          ? { key: EXACT_GROUP, label: t("search-users-group-exact") }
                          : { key: SIMILAR_GROUP, label: t("search-users-group-similar") },
                    })}
                    responsive={TABLE_STACK}
                    emptyState={null}
                  />
                </div>
              )}
              {!isStale && (state.hasSimilarTimedOut || state.hasFuzzyFailed) ? (
                <Infobox tone={TONE.WARNING}>
                  {state.hasSimilarTimedOut
                    ? t("search-users-similar-timed-out")
                    : t("search-users-similar-failed")}{" "}
                  <Button variant="tertiary" size="small" onClick={onRetryFuzzy}>
                    {t("try-again")}
                  </Button>
                </Infobox>
              ) : null}
              {!isStale && state.resultCount !== null && state.resultCount > 0 ? (
                <p className={summaryCss}>
                  {t("search-users-result-count", { count: state.resultCount })}
                  {state.hasMoreSimilar
                    ? ` ${t("search-users-more-similar", { count: state.similarUsers?.length ?? 0 })}`
                    : null}
                </p>
              ) : null}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </AnimatedHeight>
  )
}

export default withErrorBoundary(SearchUsersResults)
