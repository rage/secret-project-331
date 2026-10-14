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
import { deriveSearchUsersState } from "./searchUsersState"
import SearchUsersStatus from "./SearchUsersStatus"
import useSearchUsersLiveRegion from "./useSearchUsersLiveRegion"
import useSearchUsersQueries, { isSearchTermTooShort } from "./useSearchUsersQueries"

const formCss = css`
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
`

const fieldCss = css`
  flex-grow: 1;
`

/**
 * As tall as the md TextField's input box (2rem of padding plus a 1.5 line), so the button centres
 * on the input and not on any message below it.
 */
const buttonSlotCss = css`
  display: flex;
  align-items: center;
  height: calc(2rem + 1.5em);
`

interface SearchFields {
  search: string
}

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
  const { control, handleSubmit, watch, setValue, getValues } = useForm<SearchFields>({
    defaultValues: { search: inputValue },
  })
  const typedSearch = watch("search")

  useEffect(() => {
    setInputValue(typedSearch)
  }, [typedSearch, setInputValue])

  // The URL can change the input too, e.g. on back navigation.
  useEffect(() => {
    if (getValues("search") !== inputValue) {
      setValue("search", inputValue)
    }
  }, [inputValue, getValues, setValue])

  const { exactQuery, fuzzyQuery } = useSearchUsersQueries(searchQuery)
  const state = deriveSearchUsersState(exactQuery, fuzzyQuery)
  const hasActiveSearch = searchQuery !== ""
  const isTooShort = isSearchTermTooShort(searchQuery)
  const liveRegionMessage = useSearchUsersLiveRegion({ searchQuery, isTooShort, state })

  return (
    <OnlyRenderIfPermissions
      action={{ type: "view_user_progress_or_details" }}
      resource={{ type: "global_permissions" }}
      elseRender={<ErrorBanner variant="readOnly" error={t("error-unauthorized")} />}
    >
      <h1>{t("title-user-search")}</h1>

      <form className={formCss} onSubmit={handleSubmit(runImmediate)}>
        <TextField
          name="search"
          control={control}
          label={t("search-users-field-label")}
          className={fieldCss}
        />
        <div className={buttonSlotCss}>
          <Button type="submit" variant="primary" size="medium">
            {t("button-text-search")}
          </Button>
        </div>
      </form>

      <SearchUsersStatus state={state} searchQuery={searchQuery} isTooShort={isTooShort} />

      <VisuallyHidden aria-live="polite" aria-atomic>
        {liveRegionMessage}
      </VisuallyHidden>

      {hasActiveSearch && (
        <SearchUsersResults
          state={state}
          isTooShort={isTooShort}
          onRetryExact={() => void exactQuery.refetch()}
          onRetryFuzzy={() => void fuzzyQuery.refetch()}
        />
      )}
    </OnlyRenderIfPermissions>
  )
}

export default withErrorBoundary(withSuspenseBoundary(withSignedIn(SearchUsersPage)))
