import { useQuery } from "@tanstack/react-query"

import { isPageChapterFrontPage } from "../services/backend"
import { assertNotNullOrUndefined } from "../shared-module/common/utils/nullability"

const useIsPageChapterFrontPage = (pageId: string | undefined) => {
  const isChapterFrontPageQuery = useQuery({
    queryKey: [`is-page-${pageId}-chapter-front-page`],
    queryFn: () => {
      return isPageChapterFrontPage(assertNotNullOrUndefined(pageId))
    },
    enabled: pageId !== undefined,
  })
  return isChapterFrontPageQuery
}

export default useIsPageChapterFrontPage
