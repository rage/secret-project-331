import { css } from "@emotion/css"
import { UseQueryResult } from "@tanstack/react-query"
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

import { UserDetail } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

export interface SearchUsersResultsProps {
  searchByEmailQuery: UseQueryResult<UserDetail[], unknown>
  searchByOtherDetailsQuery: UseQueryResult<UserDetail[], unknown>
  searchFuzzyMatchQuery: UseQueryResult<UserDetail[], unknown>
}

const SearchUsersResults: React.FC<React.PropsWithChildren<SearchUsersResultsProps>> = ({
  searchByEmailQuery,
  searchByOtherDetailsQuery,
  searchFuzzyMatchQuery,
}) => {
  const { t } = useTranslation()
  const [data, userIdsFromFuzzyMatch] = useMemo(() => {
    let res: UserDetail[] = []
    let userIdsFromFuzzyMatch: string[] = []
    if (searchByEmailQuery.data) {
      res = res.concat(searchByEmailQuery.data)
    }
    if (searchByOtherDetailsQuery.data) {
      const newSearchResults = differenceBy(searchByOtherDetailsQuery.data, res, "user_id")
      res = res.concat(newSearchResults)
    }
    if (searchFuzzyMatchQuery.data) {
      const newSearchResults = differenceBy(searchFuzzyMatchQuery.data, res, "user_id")
      userIdsFromFuzzyMatch = newSearchResults.map((user_details) => user_details.user_id)
      res = res.concat(newSearchResults)
    }

    return [res, new Set(userIdsFromFuzzyMatch)]
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
      // eslint-disable-next-line i18next/no-literal-string
      id: "details",
      header: t("button-details"),
      cell: (props) => (
        <Link href={`/manage/users/${props.row.original.user_id}`}>
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

  if (searchByEmailQuery.isError) {
    return <ErrorBanner variant="readOnly" error={searchByEmailQuery.error} />
  }

  if (searchByEmailQuery.isFetching) {
    return <Spinner variant="medium" />
  }

  if (!data) {
    return null
  }

  if (data.length === 0) {
    return <p>{t("text-no-results")}</p>
  }

  return (
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
  )
}

export default withErrorBoundary(SearchUsersResults)
