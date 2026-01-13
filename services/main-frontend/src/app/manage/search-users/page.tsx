"use client"
import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import SearchUsersResults from "@/components/page-specific/manage/search-users/SearchUsersResults"
import {
  searchForUserDetailsByEmail,
  searchForUserDetailsByOtherDetails,
  searchForUserDetailsFuzzyMatch,
} from "@/services/backend/user-details"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"

const SearchUsersPage: React.FC = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initialSearch = searchParams.get("search") ?? ""
  const [typedSearchQuery, setTypedSearchQuery] = useState(initialSearch)
  const [searchQuery, setSearchQuery] = useState<string>(typedSearchQuery)
  const trimmedSearchQuery = searchQuery.trim()
  const searchByEmailQuery = useQuery({
    queryKey: ["searchUsersByEmail", searchQuery],
    queryFn: () => searchForUserDetailsByEmail(assertNotNullOrUndefined(searchQuery)),
    enabled: trimmedSearchQuery !== "",
  })
  const searchByOtherDetailsQuery = useQuery({
    queryKey: ["searchUsersByOtherDetails", searchQuery],
    queryFn: () => searchForUserDetailsByOtherDetails(assertNotNullOrUndefined(searchQuery)),
    enabled: trimmedSearchQuery !== "",
  })
  const searchFuzzyMatchQuery = useQuery({
    queryKey: ["searchUsersFuzzyMatch", searchQuery],
    queryFn: () => searchForUserDetailsFuzzyMatch(assertNotNullOrUndefined(searchQuery)),
    enabled: trimmedSearchQuery !== "",
  })
  const onSearch = () => {
    const value = typedSearchQuery.trim()
    const params = new URLSearchParams(searchParams)
    if (value === "") {
      params.delete("search")
    } else {
      // eslint-disable-next-line i18next/no-literal-string
      params.set("search", value)
    }
    const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`
    router.replace(newUrl)
    setSearchQuery(value)
  }

  return (
    <OnlyRenderIfPermissions
      action={{ type: "view_user_progress_or_details" }}
      resource={{ type: "global_permissions" }}
      elseRender={<ErrorBanner variant="readOnly" error={t("error-unauthorized")} />}
    >
      <h1>{t("title-user-search")}</h1>

      <div>
        <div
          className={css`
            display: flex;
          `}
        >
          <TextField
            label={t("text-field-label-search")}
            className={css`
              flex-grow: 1;
            `}
            value={typedSearchQuery}
            onChange={(e) => setTypedSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onSearch()
              }
            }}
          />
          <div
            className={css`
              display: flex;
              align-items: center;
              margin-left: 1rem;
            `}
          >
            <Button
              variant="primary"
              size="medium"
              onClick={onSearch}
              disabled={searchByEmailQuery.isFetching}
            >
              {t("button-text-search")}
            </Button>
          </div>
        </div>
      </div>

      {trimmedSearchQuery !== "" && (
        <SearchUsersResults
          searchByEmailQuery={searchByEmailQuery}
          searchByOtherDetailsQuery={searchByOtherDetailsQuery}
          searchFuzzyMatchQuery={searchFuzzyMatchQuery}
        />
      )}
    </OnlyRenderIfPermissions>
  )
}

export default withErrorBoundary(withSuspenseBoundary(withSignedIn(SearchUsersPage)))
