export const coursePlanQueryKeys = {
  list: () => ["course-designer-plans"] as const,
  detail: (planId: string) => ["course-designer-plan", planId] as const,
}
