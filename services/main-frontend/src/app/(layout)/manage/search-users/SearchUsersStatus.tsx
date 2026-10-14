"use client"

import { css } from "@emotion/css"
import type { TFunction } from "i18next"
import React from "react"
import { useTranslation } from "react-i18next"

import SearchProgressBar from "./SearchProgressBar"
import type { SearchUsersState } from "./searchUsersState"

const slotCss = css`
  display: grid;
  grid-template-rows: auto 1fr;
  height: calc(var(--space-6) + var(--space-2));
  margin: var(--space-2) 0 var(--space-3);
`

/** One line only: a wrapping summary would change the slot's height and push the results. */
const summaryCss = css`
  align-self: center;
  margin: 0;
  overflow: hidden;
  font-size: var(--font-size-1);
  color: var(--color-gray-500);
  text-overflow: ellipsis;
  white-space: nowrap;
`

const summaryText = (t: TFunction, state: SearchUsersState): string => {
  if (state.resultCount !== null) {
    if (state.resultCount === 0) {
      return ""
    }
    const count = t("search-users-result-count", { count: state.resultCount })
    return state.hasMoreSimilar
      ? `${count} ${t("search-users-more-similar", { count: state.similarUsers?.length ?? 0 })}`
      : count
  }
  if (state.isExactSettled && !state.hasExactFailed) {
    return t("search-users-exact-count-looking-for-similar", { count: state.exactUsers.length })
  }
  return ""
}

export interface SearchUsersStatusProps {
  state: SearchUsersState
  /** The submitted search term; empty when nothing is being searched. */
  searchQuery: string
  isTooShort: boolean
}

/**
 * Fixed-height slot between the search form and the results with the progress bar and a summary.
 * Not a live region: `useSearchUsersLiveRegion` announces the same changes.
 */
const SearchUsersStatus: React.FC<SearchUsersStatusProps> = ({
  state,
  searchQuery,
  isTooShort,
}) => {
  const { t } = useTranslation()
  const summary = searchQuery === "" || isTooShort ? "" : summaryText(t, state)

  return (
    <div className={slotCss}>
      <SearchProgressBar isSearching={state.isSearching} searchKey={searchQuery} />
      <p className={summaryCss} title={summary || undefined}>
        {summary}
      </p>
    </div>
  )
}

export default SearchUsersStatus
