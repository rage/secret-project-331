"use client"

import { useQuery } from "@tanstack/react-query"
import { validate } from "uuid"

import { getCmsPageInfoOptions } from "@/generated/api/@tanstack/react-query.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

const usePageInfo = (pageId: string, prefix: string) => {
  // To prevent this to be called with '[id]' because the next.js router is not ready yet
  const isValid = validate(pageId)

  const data = useQuery(
    optionalGeneratedQueryOptions({
      value: pageId,
      isReady: (pageId): pageId is string => Boolean(pageId) && isValid && prefix === "pages",
      build: (pageId) =>
        getCmsPageInfoOptions({
          path: {
            page_id: pageId,
          },
        }),
    }),
  )
  return data
}

export default usePageInfo
