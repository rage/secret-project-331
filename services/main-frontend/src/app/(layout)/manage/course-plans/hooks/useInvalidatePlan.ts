import { useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { getCourseDesignerPlanQueryKey } from "@/generated/api/@tanstack/react-query.generated"

/** Refetches one plan's details after a change whose response does not replace them. */
export function useInvalidatePlan(planId: string): () => Promise<void> {
  const queryClient = useQueryClient()
  return useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: getCourseDesignerPlanQueryKey({ path: { plan_id: planId } }),
      }),
    [planId, queryClient],
  )
}
