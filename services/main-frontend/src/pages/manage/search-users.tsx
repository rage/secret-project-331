import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/router"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import SearchUsersResults from "../../components/page-specific/manage/search-users/SearchUsersResults"
import {
  searchForUserDetailsByEmail,
  searchForUserDetailsByOtherDetails,
  searchForUserDetailsFuzzyMatch,
} from "../../services/backend/user-details"
import Button from "../../shared-module/components/Button"
import ErrorBanner from "../../shared-module/components/ErrorBanner"
import TextField from "../../shared-module/components/InputFields/TextField"
import OnlyRenderIfPermissions from "../../shared-module/components/OnlyRenderIfPermissions"
import { withSignedIn } from "../../shared-module/contexts/LoginStateContext"
import useQueryParameter from "../../shared-module/hooks/useQueryParameter"
import { assertNotNullOrUndefined } from "../../shared-module/utils/nullability"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

const SearchUsersPage: React.FC<React.PropsWithChildren<unknown>> = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const searchQueryParameter = useQueryParameter("search")
  const [typedSearchQuery, setTypedSearchQuery] = useState(searchQueryParameter ?? "")
  const [searchQuery, setSearchQuery] = useState<string>(typedSearchQuery)
  const trimmedSearchQuery = searchQuery.trim()
  const searchByEmailQuery = useQuery(
    ["searchUsersByEmail", searchQuery],
    () => searchForUserDetailsByEmail(assertNotNullOrUndefined(searchQuery)),
    {
      enabled: trimmedSearchQuery !== "",
    },
  )
  const searchByOtherDetailsQuery = useQuery(
    ["searchUsersByOtherDetails", searchQuery],
    () => searchForUserDetailsByOtherDetails(assertNotNullOrUndefined(searchQuery)),
    {
      enabled: trimmedSearchQuery !== "",
    },
  )
  const searchFuzzyMatchQuery = useQuery(
    ["searchUsersFuzzyMatch", searchQuery],
    () => searchForUserDetailsFuzzyMatch(assertNotNullOrUndefined(searchQuery)),
    {
      enabled: trimmedSearchQuery !== "",
    },
  )
  const onSearch = () => {
    const value = typedSearchQuery.trim()
    if (value === "") {
      delete router.query.search
    } else {
      router.query.search = value
    }
    router.replace(router, undefined, { shallow: true })
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

export default withErrorBoundary(withSignedIn(SearchUsersPage))
