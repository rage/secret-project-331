import { useQuery } from "@tanstack/react-query"

import { isPageChapterFrontPage } from "../services/backend"
import { assertNotNullOrUndefined } from "../shared-module/utils/nullability"

const useIsPageChapterFrontPage = (pageId: string | undefined) => {
  const isChapterFrontPageQuery = useQuery(
    [`is-page-${pageId}-chapter-front-page`],
    () => {
      return isPageChapterFrontPage(assertNotNullOrUndefined(pageId))
    },
    { enabled: pageId !== undefined },
  )
  return isChapterFrontPageQuery
}

export default useIsPageChapterFrontPage
