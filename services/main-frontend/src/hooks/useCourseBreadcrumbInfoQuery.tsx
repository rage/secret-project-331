import { useQuery } from "@tanstack/react-query"

import { getCourseBreadCrumbInfo } from "../services/backend/courses"
import { assertNotNullOrUndefined } from "../shared-module/common/utils/nullability"

const useCourseBreadcrumbInfoQuery = (courseId: string | null) => {
  return useQuery({
    queryKey: ["course-breadcrumb-info", courseId],
    queryFn: () => getCourseBreadCrumbInfo(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })
}

export default useCourseBreadcrumbInfoQuery
