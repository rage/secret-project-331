import { useQuery } from "@tanstack/react-query"

import { fetchPageByCourseIdAndLanguageGroupId } from "../services/backend"
import { assertNotNullOrUndefined } from "../shared-module/utils/nullability"

const useNewPagePath = (
  course_id: string | undefined,
  page_language_group_id: string | undefined,
) => {
  const query = useQuery(
    [`courses-${course_id}-pages-${page_language_group_id}`],
    () => {
      return fetchPageByCourseIdAndLanguageGroupId(
        assertNotNullOrUndefined(course_id),
        assertNotNullOrUndefined(page_language_group_id),
      )
    },
    { enabled: course_id !== undefined && page_language_group_id !== undefined },
  )
  return query.data?.url_path
}
export default useNewPagePath
