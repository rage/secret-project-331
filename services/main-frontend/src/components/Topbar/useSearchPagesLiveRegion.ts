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

  useEffect(() => {
    const trimmedQuery = searchQuery.trim()

    const searchQueryChanged = previousSearchQueryRef.current !== searchQuery
    if (searchQueryChanged) {
      previousSearchQueryRef.current = searchQuery
      hasSettledForCurrentQueryRef.current = false
      lastAnnouncedMessageRef.current = ""
    }

    let nextMessage = ""
    if (trimmedQuery === "") {
      nextMessage = ""
      hasSettledForCurrentQueryRef.current = false
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
