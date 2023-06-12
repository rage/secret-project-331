import { useQuery } from "@tanstack/react-query"

import { fetchPageByCourseIdAndLanguageGroupId } from "../services/backend"
import { assertNotNullOrUndefined } from "../shared-module/utils/nullability"

const useNewPagePath = (
  course_id: string | undefined,
  page_language_group_id: string | undefined | null,
): string | null => {
  const query = useQuery(
    [`courses-${course_id}-pages-by-language-group-id-${page_language_group_id}`],
    () => {
      return fetchPageByCourseIdAndLanguageGroupId(
        assertNotNullOrUndefined(course_id),
        assertNotNullOrUndefined(page_language_group_id),
      )
    },
    {
      enabled:
        course_id !== undefined &&
        course_id !== null &&
        page_language_group_id !== undefined &&
        page_language_group_id !== null,
    },
  )
  return query.data?.url_path ?? null
}
export default useNewPagePath
