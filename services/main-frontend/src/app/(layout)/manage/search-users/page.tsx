"use client"

import { css } from "@emotion/css"
import React, { useEffect } from "react"
import { VisuallyHidden } from "react-aria"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import useUrlSyncedDebouncedQuery from "@/shared-module/common/hooks/useUrlSyncedDebouncedQuery"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"
import { Button, TextField } from "@/shared-module/components"

import SearchUsersResults from "./SearchUsersResults"
import useSearchUsersLiveRegion from "./useSearchUsersLiveRegion"
import useSearchUsersQueries from "./useSearchUsersQueries"

const SearchUsersPage: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("title-user-search"))
  const {
    inputValue,
    setInputValue,
    queryValue: searchQuery,
    runImmediate,
  } = useUrlSyncedDebouncedQuery({
    // oxlint-disable-next-line i18next/no-literal-string
    paramName: "search",
    delayMs: 250,
  })
  const { control, watch, setValue } = useForm<{ search: string }>({
    defaultValues: { search: inputValue },
  })
  const searchFieldValue = watch("search")

  // `useUrlSyncedDebouncedQuery` owns `inputValue` (URL back/forward, a pasted link); mirror it in.
  useEffect(() => {
    if (inputValue !== searchFieldValue) {
      setValue("search", inputValue)
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue])

  // And mirror the field's own edits back out, so the debounce/URL sync still drives off them.
  useEffect(() => {
    if (searchFieldValue !== inputValue) {
      setInputValue(searchFieldValue)
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFieldValue])

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
        <form
          onSubmit={(e) => {
            e.preventDefault()
            runImmediate()
          }}
          className={css`
            display: flex;
          `}
        >
          <div
            className={css`
              flex-grow: 1;
            `}
          >
            <TextField name="search" control={control} label={t("text-field-label-search")} />
          </div>
          <div
            className={css`
              display: flex;
              align-items: center;
              margin-left: 1rem;
            `}
          >
            <Button
              type="submit"
              variant="primary"
              size="medium"
              disabled={searchByEmailQuery.isFetching}
            >
              {t("button-text-search")}
            </Button>
          </div>
        </form>
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
