"use client"

import { css } from "@emotion/css"
import type { UseQueryResult } from "@tanstack/react-query"
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { differenceBy } from "lodash"
import Link from "next/link"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { UserDetail } from "@/generated/api/types.generated"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { manageUserRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

export interface SearchUsersResultsProps {
  searchByEmailQuery: UseQueryResult<UserDetail[], unknown>
  searchByOtherDetailsQuery: UseQueryResult<UserDetail[], unknown>
  searchFuzzyMatchQuery: UseQueryResult<UserDetail[], unknown>
}

const SEARCH_QUERY_COUNT = 3

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
      <ErrorBanner variant="readOnly" error={firstError} />
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

  const columnHelper = createColumnHelper<UserDetail>()

  const columns = [
    columnHelper.accessor("user_id", { header: t("label-user-id") }),
    columnHelper.accessor("email", {
      header: t("label-email"),
    }),
    columnHelper.accessor("first_name", {
      header: t("first-name"),
    }),
    columnHelper.accessor("last_name", {
      header: t("last-name"),
    }),
    columnHelper.display({
      // oxlint-disable-next-line i18next/no-literal-string
      id: "details",
      header: t("button-details"),
      cell: (props) => (
        <Link href={manageUserRoute(props.row.original.user_id)}>
          <Button variant="tertiary" size="medium">
            {t("button-details")}
          </Button>
        </Link>
      ),
    }),
  ]

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

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
      <Spinner variant="small" disableMargin />
    </div>
  ) : null

  if (data.length === 0) {
    return (
      <div>
        {errorBanner}
        {progressIndicator}
        {isAnyFetching ? <Spinner variant="medium" /> : <p>{t("text-no-results")}</p>}
      </div>
    )
  }

  return (
    <div>
      {errorBanner}
      {progressIndicator}
      <div
        className={css`
          table {
            width: 100%;
          }
          th {
            text-align: left;
          }
          td {
            padding: 0.5rem 2rem;
            padding-left: 0;
          }
        `}
      >
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id}>
                    {!header.isPlaceholder &&
                      flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={css`
                  ${userIdsFromFuzzyMatch.has(row.original.user_id) && `opacity: 0.7;`}
                `}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default withErrorBoundary(SearchUsersResults)
