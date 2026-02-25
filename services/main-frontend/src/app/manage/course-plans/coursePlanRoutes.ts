export const coursePlanHubRoute = (planId: string) => {
  // eslint-disable-next-line i18next/no-literal-string
  return `/manage/course-plans/${planId}`
}

export const coursePlanScheduleRoute = (planId: string) => {
  // eslint-disable-next-line i18next/no-literal-string
  return `/manage/course-plans/${planId}/schedule`
}

export const coursePlanWorkspaceRoute = (planId: string) => {
  // eslint-disable-next-line i18next/no-literal-string
  return `/manage/course-plans/${planId}/workspace`
}
