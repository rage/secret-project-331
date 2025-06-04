import { useQuery } from "@tanstack/react-query"

import { fetchPageInfo } from "@/services/backend/pages"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

export const usePageInfo = (pageId: string | null) => {
  return useQuery({
    queryKey: [`page-info-id-${pageId}`],
    queryFn: () => {
      return fetchPageInfo(assertNotNullOrUndefined(pageId))
    },
    enabled: !!pageId,
  })
}
