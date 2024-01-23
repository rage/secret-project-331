import { useQuery } from "@tanstack/react-query"

import { fetchUserModuleCompletionStatuses } from "../services/backend"
import { assertNotNullOrUndefined } from "../shared-module/utils/nullability"

const useUserModuleCompletions = (courseInstanceId: string | undefined | null) => {
  const query = useQuery({
    queryKey: [`course-instance-${courseInstanceId}-module-completions`],
    queryFn: () => fetchUserModuleCompletionStatuses(assertNotNullOrUndefined(courseInstanceId)),
    enabled: !!courseInstanceId,
  })
  return query
}

export default useUserModuleCompletions
