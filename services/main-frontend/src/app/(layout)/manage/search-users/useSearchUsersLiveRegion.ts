import type { UseQueryResult } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import type { UserDetail } from "@/generated/api/types.generated"

interface UseSearchUsersLiveRegionProps {
  searchQuery: string
  searchByEmailQuery: UseQueryResult<UserDetail[], unknown>
  searchByOtherDetailsQuery: UseQueryResult<UserDetail[], unknown>
  searchFuzzyMatchQuery: UseQueryResult<UserDetail[], unknown>
}

/** Produces deduplicated live-region announcements for search state changes. */
const useSearchUsersLiveRegion = ({
  searchQuery,
  searchByEmailQuery,
  searchByOtherDetailsQuery,
  searchFuzzyMatchQuery,
}: UseSearchUsersLiveRegionProps): string => {
  const { t } = useTranslation()
  const [liveRegionMessage, setLiveRegionMessage] = useState("")
  const lastAnnouncedMessageRef = useRef("")
  const previousSearchQueryRef = useRef(searchQuery)
  const hasSettledForCurrentQueryRef = useRef(false)

  useEffect(() => {
    const isAnyError =
      searchByEmailQuery.isError ||
      searchByOtherDetailsQuery.isError ||
      searchFuzzyMatchQuery.isError
    const isAnyFetching =
      searchByEmailQuery.isFetching ||
      searchByOtherDetailsQuery.isFetching ||
      searchFuzzyMatchQuery.isFetching

    const emailData = searchByEmailQuery.data ?? []
    const otherData = searchByOtherDetailsQuery.data ?? []
    const fuzzyData = searchFuzzyMatchQuery.data ?? []
    const resultCount = new Set(
      [...emailData, ...otherData, ...fuzzyData].map((user) => user.user_id),
    ).size

    const searchQueryChanged = previousSearchQueryRef.current !== searchQuery
    if (searchQueryChanged) {
      previousSearchQueryRef.current = searchQuery
      hasSettledForCurrentQueryRef.current = false
      lastAnnouncedMessageRef.current = ""
    }

    let nextMessage = ""
    if (searchQuery === "") {
      nextMessage = ""
      hasSettledForCurrentQueryRef.current = false
    } else if (isAnyError) {
      nextMessage = t("search-users-live-region-search-failed")
      hasSettledForCurrentQueryRef.current = true
    } else if (isAnyFetching && !hasSettledForCurrentQueryRef.current) {
      nextMessage = t("search-users-live-region-searching-users")
    } else if (!isAnyFetching) {
      hasSettledForCurrentQueryRef.current = true
      if (resultCount === 0) {
        nextMessage = t("search-users-live-region-no-users-found")
      } else if (resultCount === 1) {
        nextMessage = t("search-users-live-region-one-result-found")
      } else {
        nextMessage = t("search-users-live-region-many-results-found", { count: resultCount })
      }
    }

    if (searchQuery === "" && nextMessage === "") {
      lastAnnouncedMessageRef.current = ""
      setLiveRegionMessage("")
      return
    }

    if (nextMessage !== "" && nextMessage !== lastAnnouncedMessageRef.current) {
      lastAnnouncedMessageRef.current = nextMessage
      setLiveRegionMessage(nextMessage)
    }
  }, [
    searchByEmailQuery.data,
    searchByEmailQuery.isError,
    searchByEmailQuery.isFetching,
    searchByOtherDetailsQuery.data,
    searchByOtherDetailsQuery.isError,
    searchByOtherDetailsQuery.isFetching,
    searchFuzzyMatchQuery.data,
    searchFuzzyMatchQuery.isError,
    searchFuzzyMatchQuery.isFetching,
    searchQuery,
    t,
  ])

  return liveRegionMessage
}

export default useSearchUsersLiveRegion
