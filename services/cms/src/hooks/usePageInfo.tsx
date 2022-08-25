import { useQuery } from "@tanstack/react-query"

import { fetchPageInfo } from "../services/backend/pages"

const usePageInfo = (pageId: string, prefix: string) => {
  const data = useQuery([`page-info-id-${pageId}`], () => {
    if (prefix !== "pages") {
      return null
    }
    if (!pageId) {
      return null
    }
    return fetchPageInfo(pageId)
  })
  return data
}

export default usePageInfo
