/* eslint-disable i18next/no-literal-string */

export function manageCourseInstancePageRoute(courseInstanceId: string) {
  return `/manage/course-instances/${courseInstanceId}`
}

export function manageCourseInstanceEmailsPageRoute(courseInstanceId: string) {
  return `/manage/course-instances/${courseInstanceId}/emails`
}
