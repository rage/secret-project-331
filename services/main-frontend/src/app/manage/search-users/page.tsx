"use client"

import { css } from "@emotion/css"
import React from "react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import SearchUsersResults from "./SearchUsersResults"
import useSearchUsersLiveRegion from "./useSearchUsersLiveRegion"
import useSearchUsersQueries from "./useSearchUsersQueries"

import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useUrlSyncedDebouncedQuery from "@/shared-module/common/hooks/useUrlSyncedDebouncedQuery"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"

const SearchUsersPage: React.FC = () => {
  const { t } = useTranslation()
  const {
    inputValue,
    setInputValue,
    queryValue: searchQuery,
    runImmediate,
  } = useUrlSyncedDebouncedQuery({
    // eslint-disable-next-line i18next/no-literal-string
    paramName: "search",
    delayMs: 250,
  })
  const queries = useSearchUsersQueries(searchQuery)
  const { searchByEmailQuery, searchByOtherDetailsQuery, searchFuzzyMatchQuery } = queries
  const hasActiveSearch = searchQuery !== ""
  const liveRegionMessage = useSearchUsersLiveRegion({
    searchQuery,
    searchByEmailQuery,
    searchByOtherDetailsQuery,
    searchFuzzyMatchQuery,
  })

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
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                runImmediate()
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
              onClick={runImmediate}
              disabled={searchByEmailQuery.isFetching}
            >
              {t("button-text-search")}
            </Button>
          </div>
        </div>
      </div>

      <VisuallyHidden aria-live="polite" aria-atomic>
        {liveRegionMessage}
      </VisuallyHidden>

      {hasActiveSearch && (
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
