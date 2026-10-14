"use client"

import { css, cx, keyframes } from "@emotion/css"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import React, { useId, useLayoutEffect, useRef, useState } from "react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import type { UserDetail } from "@/generated/api/types.generated"
import { manageUserRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button, EmptyState, Infobox, Link, TONE } from "@/shared-module/components"
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
const INLINE_SPAN = "span" as const
const LINK_APPEARANCE = "inherit" as const
const SHORT_ID_LENGTH = 8
/** Name and email bar widths per placeholder row, so the skeleton doesn't read as a grid. */
const SKELETON_BAR_WIDTHS_EM = [
  [9, 14],
  [7, 12],
  [10, 15],
] as const

const rowEntrance = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
`

const listCss = css`
  list-style: none;
  padding: 0;
  /* Row text lines up with the group labels; the row background bleeds past them. */
  margin: 0 calc(-1 * var(--space-3));

  & > li {
    animation: ${rowEntrance} 200ms cubic-bezier(0.2, 0, 0, 1) both;
    animation-delay: ${STAGGERED_ROW_COUNT * STAGGER_STEP_MS}ms;
  }

  & > li + li {
    border-top: 1px solid var(--color-gray-75);
  }
  ${Array.from(
    { length: STAGGERED_ROW_COUNT },
    (_, index) =>
      `& > li:nth-child(${index + 1}) { animation-delay: ${index * STAGGER_STEP_MS}ms; }`,
  ).join("\n")}

  @media (prefers-reduced-motion: reduce) {
    & > li {
      animation: none;
    }
  }
`

const rowCss = css`
  display: block;
  padding: var(--space-3);
  border-radius: var(--space-2);
  color: inherit;
  text-decoration: none;

  &:hover {
    background: var(--color-gray-50);
  }

  &:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: calc(-1 * var(--focus-ring-width));
  }
`

const exactRowCss = css`
  background: var(--color-green-50);

  &:hover {
    background: var(--color-green-75);
  }
`

/** `1lh` pins the line to one line box, so a skeleton line is exactly as tall as a real one. */
const firstLineCss = css`
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  min-width: 0;
  height: 1lh;
`

const nameCss = css`
  min-width: 0;
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-underline-offset: 0.15em;

  a:hover &,
  a:focus-visible & {
    text-decoration: underline;
  }

  a:visited & {
    color: var(--color-purple-600);
  }
`

const noNameCss = css`
  font-weight: 400;
  color: var(--color-gray-500);
`

const shortIdCss = css`
  flex: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--font-size-0);
  color: var(--color-gray-500);
`

const emailCss = css`
  display: block;
  font-size: var(--font-size-1);
  color: var(--color-gray-500);
  overflow-wrap: anywhere;
`

const skeletonLineCss = css`
  display: flex;
  align-items: center;
  height: 1lh;
`

const skeletonBarCss = SKELETON_BAR_WIDTHS_EM.map(([nameWidth, emailWidth]) => ({
  name: cx(skeletonBlockBaseCss, skeletonBlockLightCss, skeletonBlockDimsCss(`${nameWidth}em`, 13)),
  email: cx(
    skeletonBlockBaseCss,
    skeletonBlockLightCss,
    skeletonBlockDimsCss(`${emailWidth}em`, 11),
  ),
}))

const groupLabelCss = css`
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-1);
  font-weight: 600;
  color: var(--color-gray-500);
`

const exactGroupLabelCss = css`
  color: var(--color-green-700);
`

const groupsCss = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4-5);
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

const sectionCss = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-3);
`

/** Clips only vertically, so the row backgrounds can bleed sideways while the height animates. */
const animatedHeightCss = css`
  overflow-x: visible;
  overflow-y: clip;
  overflow-clip-margin: var(--space-1);
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

const UserResult: React.FC<{ user: UserDetail; isExact: boolean }> = ({ user, isExact }) => {
  const { t } = useTranslation()
  const name = [user.first_name, user.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")

  return (
    <Link
      href={manageUserRoute(user.user_id)}
      appearance={LINK_APPEARANCE}
      className={cx(rowCss, isExact && exactRowCss)}
    >
      <span className={firstLineCss}>
        {name ? (
          <span className={nameCss} title={name}>
            {name}
          </span>
        ) : (
          <span className={cx(nameCss, noNameCss)}>{t("search-users-no-name")}</span>
        )}
        <span className={shortIdCss} aria-hidden="true">
          {user.user_id.slice(0, SHORT_ID_LENGTH)}
        </span>
      </span>
      <span className={emailCss}>{user.email}</span>
      <VisuallyHidden elementType={INLINE_SPAN}>
        {t("search-users-user-id", { id: user.user_id })}
      </VisuallyHidden>
    </Link>
  )
}

const SkeletonResult: React.FC<{ index: number }> = ({ index }) => {
  const bars = skeletonBarCss[index % skeletonBarCss.length]
  return (
    <div className={rowCss}>
      <span className={cx(firstLineCss, skeletonLineCss)}>
        <span className={bars?.name} />
      </span>
      <span className={cx(emailCss, skeletonLineCss)}>
        <span className={bars?.email} />
      </span>
    </div>
  )
}

const ResultList: React.FC<{ rows: ResultRow[]; labelledBy?: string; label?: string }> = ({
  rows,
  labelledBy,
  label,
}) => (
  <ul className={listCss} aria-labelledby={labelledBy} aria-label={label}>
    {rows.map((row) => (
      <li key={resultRowKey(row)} aria-hidden={row.kind === "placeholder" ? true : undefined}>
        {row.kind === "user" ? (
          <UserResult user={row.user} isExact={row.isExact} />
        ) : (
          <SkeletonResult index={row.index} />
        )}
      </li>
    ))}
  </ul>
)

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
  const exactLabelId = useId()
  const similarLabelId = useId()

  const isStale = state.previous !== null
  const rows = resultRows(state)
  const exactRows = rows.filter((row) => row.kind === "user" && row.isExact)
  const similarRows = rows.filter((row) => !(row.kind === "user" && row.isExact))
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
          {view === "list" && (
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
                  {exactRows.length > 0 ? (
                    <div className={groupsCss}>
                      <section>
                        <h2 id={exactLabelId} className={cx(groupLabelCss, exactGroupLabelCss)}>
                          {t("search-users-group-exact")}
                        </h2>
                        <ResultList rows={exactRows} labelledBy={exactLabelId} />
                      </section>
                      {similarRows.length > 0 && (
                        <section>
                          <h2 id={similarLabelId} className={groupLabelCss}>
                            {t("search-users-group-similar")}
                          </h2>
                          <ResultList rows={similarRows} labelledBy={similarLabelId} />
                        </section>
                      )}
                    </div>
                  ) : (
                    <ResultList rows={rows} label={t("title-user-search")} />
                  )}
                </div>
              )}
              {!isStale && state.hasFuzzyFailed ? (
                <Infobox tone={TONE.WARNING}>
                  {t("search-users-similar-failed")}{" "}
                  <Button variant="tertiary" size="small" onClick={onRetryFuzzy}>
                    {t("try-again")}
                  </Button>
                </Infobox>
              ) : null}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </AnimatedHeight>
  )
}

export default withErrorBoundary(SearchUsersResults)
