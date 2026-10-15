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
      isReady: (id): id is string => Boolean(id) && isValid && prefix === "pages",
      build: (id) =>
        getCmsPageInfoOptions({
          path: {
            page_id: id,
          },
        }),
    }),
  )
  return data
}

export default usePageInfo
