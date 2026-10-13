"use client"

import { css } from "@emotion/css"
import type { UseQueryResult } from "@tanstack/react-query"
import { differenceBy } from "lodash"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { UserDetail } from "@/generated/api/types.generated"
import { manageUserRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import {
  ErrorNotice,
  Link,
  LoadingRegion,
  Spinner,
  Table,
  type TableColumn,
} from "@/shared-module/components"

// useSearchUsersLiveRegion already announces a failed search; a second live region would repeat it.
const ERROR_ANNOUNCEMENT = "off"

export interface SearchUsersResultsProps {
  searchByEmailQuery: UseQueryResult<UserDetail[], unknown>
  searchByOtherDetailsQuery: UseQueryResult<UserDetail[], unknown>
  searchFuzzyMatchQuery: UseQueryResult<UserDetail[], unknown>
}

const SEARCH_QUERY_COUNT = 3

const fuzzyMatchCss = css`
  opacity: 0.7;
`

const SearchUsersResults: React.FC<React.PropsWithChildren<SearchUsersResultsProps>> = ({
  searchByEmailQuery,
  searchByOtherDetailsQuery,
  searchFuzzyMatchQuery,
}) => {
  const { t } = useTranslation()
  const searchQueries = [searchByEmailQuery, searchByOtherDetailsQuery, searchFuzzyMatchQuery]
  const completedSearchCount = searchQueries.filter((query) => !query.isFetching).length
  const isAnyFetching = completedSearchCount < SEARCH_QUERY_COUNT
  const firstError = searchQueries.find((query) => query.isError)?.error
  const errorBanner =
    firstError !== undefined && firstError !== null ? (
      <ErrorNotice error={firstError} announce={ERROR_ANNOUNCEMENT} />
    ) : null

  const [data, userIdsFromFuzzyMatch] = useMemo(() => {
    let res: UserDetail[] = []
    let fuzzyMatchUserIds: string[] = []
    if (searchByEmailQuery.data) {
      res = res.concat(searchByEmailQuery.data)
    }
    if (searchByOtherDetailsQuery.data) {
      const newSearchResults = differenceBy(searchByOtherDetailsQuery.data, res, "user_id")
      res = res.concat(newSearchResults)
    }
    if (searchFuzzyMatchQuery.data) {
      const newSearchResults = differenceBy(searchFuzzyMatchQuery.data, res, "user_id")
      fuzzyMatchUserIds = newSearchResults.map((user_details) => user_details.user_id)
      res = res.concat(newSearchResults)
    }

    return [res, new Set(fuzzyMatchUserIds)]
  }, [searchByEmailQuery.data, searchByOtherDetailsQuery.data, searchFuzzyMatchQuery.data])

  const dimIfFuzzyMatch = (user: UserDetail, content: React.ReactNode) =>
    userIdsFromFuzzyMatch.has(user.user_id) ? (
      <span className={fuzzyMatchCss}>{content}</span>
    ) : (
      content
    )

  const columns: TableColumn<UserDetail>[] = [
    {
      header: t("label-user-id"),
      breakAnywhere: true,
      cell: (user) => dimIfFuzzyMatch(user, user.user_id),
    },
    {
      header: t("label-email"),
      breakAnywhere: true,
      cell: (user) => dimIfFuzzyMatch(user, user.email),
    },
    { header: t("first-name"), cell: (user) => dimIfFuzzyMatch(user, user.first_name) },
    { header: t("last-name"), cell: (user) => dimIfFuzzyMatch(user, user.last_name) },
    {
      header: t("button-details"),
      cell: (user) =>
        dimIfFuzzyMatch(
          user,
          <Link
            href={manageUserRoute(user.user_id)}
            styledAsButton
            variant="tertiary"
            size="medium"
          >
            {t("button-details")}
          </Link>,
        ),
    },
  ]

  const progressIndicator = isAnyFetching ? (
    <div
      className={css`
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 1rem 0;
      `}
    >
      <span>{t("search-users-progress", { completed: completedSearchCount })}</span>
      <Spinner size="sm" />
    </div>
  ) : null

  if (data.length === 0) {
    return (
      <div>
        {errorBanner}
        {progressIndicator}
        {isAnyFetching ? <LoadingRegion /> : <p>{t("text-no-results")}</p>}
      </div>
    )
  }

  return (
    <div>
      {errorBanner}
      {progressIndicator}
      <Table caption={t("users")} rows={data} rowKey={(user) => user.user_id} columns={columns} />
    </div>
  )
}

export default withErrorBoundary(SearchUsersResults)
