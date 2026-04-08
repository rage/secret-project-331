"use client"

import { useQuery } from "@tanstack/react-query"

import { getPageInfoOptions } from "@/services/backend/pages"

export const usePageInfo = (pageId: string | null) => {
  return useQuery({
    ...getPageInfoOptions(pageId ?? ""),
    enabled: !!pageId,
  })
}
