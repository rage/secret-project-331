import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

interface UseSearchPagesLiveRegionProps {
  searchQuery: string
  isLoading: boolean
  isError: boolean
  resultCount: number | null
}

/** Produces deduplicated live-region announcements for page-search state changes. */
const useSearchPagesLiveRegion = ({
  searchQuery,
  isLoading,
  isError,
  resultCount,
}: UseSearchPagesLiveRegionProps): string => {
  const { t } = useTranslation()
  const [liveRegionMessage, setLiveRegionMessage] = useState("")
  const lastAnnouncedMessageRef = useRef("")
  const previousSearchQueryRef = useRef(searchQuery)
  const hasSettledForCurrentQueryRef = useRef(false)
  // True from the moment the query changes until the fetch for the new query actually starts
  // (isLoading flips to true). While set, isLoading/isError/resultCount still describe the
  // PREVIOUS query (the fetch effect runs after this one), so counts must not be announced.
  const awaitingFreshResultsRef = useRef(false)

  useEffect(() => {
    const trimmedQuery = searchQuery.trim()

    const searchQueryChanged = previousSearchQueryRef.current !== searchQuery
    if (searchQueryChanged) {
      previousSearchQueryRef.current = searchQuery
      hasSettledForCurrentQueryRef.current = false
      lastAnnouncedMessageRef.current = ""
      awaitingFreshResultsRef.current = true
    }
    if (isLoading) {
      awaitingFreshResultsRef.current = false
    }

    let nextMessage = ""
    if (trimmedQuery === "") {
      nextMessage = ""
      hasSettledForCurrentQueryRef.current = false
      awaitingFreshResultsRef.current = false
    } else if (awaitingFreshResultsRef.current) {
      // Stale data from the previous query: announce "searching" and let a later render with
      // fresh isLoading/resultCount report the new query's result.
      nextMessage = t("search-pages-live-region-searching")
    } else if (isError) {
      nextMessage = t("search-pages-live-region-search-failed")
      hasSettledForCurrentQueryRef.current = true
    } else if (isLoading && !hasSettledForCurrentQueryRef.current) {
      nextMessage = t("search-pages-live-region-searching")
    } else if (!isLoading && resultCount !== null) {
      hasSettledForCurrentQueryRef.current = true
      if (resultCount === 0) {
        nextMessage = t("search-pages-live-region-no-results-found")
      } else if (resultCount === 1) {
        nextMessage = t("search-pages-live-region-one-result-found")
      } else {
        nextMessage = t("search-pages-live-region-many-results-found", { count: resultCount })
      }
    }

    if (trimmedQuery === "" && nextMessage === "") {
      lastAnnouncedMessageRef.current = ""
      setLiveRegionMessage("")
      return
    }

    if (nextMessage !== "" && nextMessage !== lastAnnouncedMessageRef.current) {
      lastAnnouncedMessageRef.current = nextMessage
      setLiveRegionMessage(nextMessage)
    }
  }, [searchQuery, isLoading, isError, resultCount, t])

  return liveRegionMessage
}

export default useSearchPagesLiveRegion
