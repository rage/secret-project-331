import { useQuery } from "@tanstack/react-query"

import { fetchPageInfo } from "../services/backend/pages"

const usePageInfo = (pageId: string) => {
  const data = useQuery([`page-info-id-${pageId}`], () => {
    if (!pageId) {
      return null
    }
    return fetchPageInfo(pageId)
  })
  return data
}

export default usePageInfo
