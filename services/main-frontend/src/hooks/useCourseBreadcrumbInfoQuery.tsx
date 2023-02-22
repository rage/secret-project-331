import { useQuery } from "@tanstack/react-query"

import { getCourseBreadCrumbInfo } from "../services/backend/courses"
import { assertNotNullOrUndefined } from "../shared-module/utils/nullability"

const useCourseBreadcrumbInfoQuery = (courseId: string | null) => {
  return useQuery(
    ["course-breadcrumb-info", courseId],
    () => getCourseBreadCrumbInfo(assertNotNullOrUndefined(courseId)),
    { enabled: !!courseId },
  )
}

export default useCourseBreadcrumbInfoQuery
