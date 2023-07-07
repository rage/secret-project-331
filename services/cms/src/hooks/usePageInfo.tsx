import { useQuery } from "@tanstack/react-query"
import { validate } from "uuid"

import { fetchPageInfo } from "../services/backend/pages"

const usePageInfo = (pageId: string, prefix: string) => {
  // To prevent this to be called with '[id]' because the next.js router is not ready yet
  const isValid = validate(pageId)

  const data = useQuery(
    [`page-info-id-${pageId}`],
    () => {
      return fetchPageInfo(pageId)
    },
    {
      enabled: !!pageId && isValid && prefix === "pages",
    },
  )
  return data
}

export default usePageInfo
