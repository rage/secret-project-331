import { useQuery } from "@tanstack/react-query"

import { getUsersByCourseId } from "@/services/backend/user-details"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

export const useUsers = (courseId: string) => {
  return useQuery({
    queryKey: ["users", courseId],
    queryFn: () => getUsersByCourseId(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })
}
