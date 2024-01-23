import { useQuery } from "@tanstack/react-query"

import { fetchUserModuleCompletionStatuses } from "../services/backend"

const useUserModuleCompletions = (courseInstanceId: string | undefined | null) => {
  const query = useQuery({
    queryKey: [`course-instance-${courseInstanceId}-module-completions`],
    queryFn: () =>
      fetchUserModuleCompletionStatuses(courseInstanceId as NonNullable<typeof courseInstanceId>),
    enabled: !!courseInstanceId,
  })
  return query
}

export default useUserModuleCompletions
