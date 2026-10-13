import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import type { SearchUsersState } from "./searchUsersState"

interface UseSearchUsersLiveRegionProps {
  searchQuery: string
  isTooShort: boolean
  state: SearchUsersState
}

/** Produces deduplicated live-region announcements for search state changes. */
const useSearchUsersLiveRegion = ({
  searchQuery,
  isTooShort,
  state,
}: UseSearchUsersLiveRegionProps): string => {
  const { t } = useTranslation()
  const [liveRegionMessage, setLiveRegionMessage] = useState("")
  const lastAnnouncedMessageRef = useRef("")
  const previousSearchQueryRef = useRef(searchQuery)

  const isFailed = !!state.exactError || !!state.fuzzyError
  const { isSearching, resultCount, hasSimilarTimedOut } = state

  useEffect(() => {
    if (previousSearchQueryRef.current !== searchQuery) {
      previousSearchQueryRef.current = searchQuery
      lastAnnouncedMessageRef.current = ""
    }

    let nextMessage = ""
    if (searchQuery === "") {
      lastAnnouncedMessageRef.current = ""
      setLiveRegionMessage("")
      return
    } else if (isTooShort) {
      nextMessage = t("search-users-too-short")
    } else if (resultCount !== null) {
      if (isFailed) {
        nextMessage = t("search-users-live-region-search-failed")
      } else if (hasSimilarTimedOut) {
        nextMessage = t("search-users-similar-timed-out")
      } else if (resultCount === 0) {
        nextMessage = t("search-users-live-region-no-users-found")
      } else if (resultCount === 1) {
        nextMessage = t("search-users-live-region-one-result-found")
      } else {
        nextMessage = t("search-users-live-region-many-results-found", { count: resultCount })
      }
    } else if (isSearching) {
      nextMessage = t("search-users-live-region-searching-users")
    }

    if (nextMessage !== "" && nextMessage !== lastAnnouncedMessageRef.current) {
      lastAnnouncedMessageRef.current = nextMessage
      setLiveRegionMessage(nextMessage)
    }
  }, [hasSimilarTimedOut, isFailed, isSearching, isTooShort, resultCount, searchQuery, t])

  return liveRegionMessage
}

export default useSearchUsersLiveRegion
