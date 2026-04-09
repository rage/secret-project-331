"use client"

import { useQuery } from "@tanstack/react-query"

import { getPageInfo } from "@/generated/api/sdk.generated"
import type { PageInfo } from "@/generated/api/types.generated"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

export const usePageInfo = (pageId: string | null) =>
  useQuery({
    queryKey: ["getPageInfo", pageId],
    queryFn: async (): Promise<PageInfo> =>
      getPageInfo({
        path: {
          page_id: assertNotNullOrUndefined(pageId),
        },
      }),
    enabled: pageId !== null,
  })
