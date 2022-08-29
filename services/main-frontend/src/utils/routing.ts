/* eslint-disable i18next/no-literal-string */

export function addCourseInstanceCompletionsPageRoute(courseInstanceId: string) {
  return `/manage/course-instances/${courseInstanceId}/add-completions`
}

export function manageCourseInstancePageRoute(courseInstanceId: string) {
  return `/manage/course-instances/${courseInstanceId}`
}

export function manageCourseInstanceEmailsPageRoute(courseInstanceId: string) {
  return `/manage/course-instances/${courseInstanceId}/emails`
}

export function manageCourseInstancePermissionsPageRoute(courseInstanceId: string) {
  return `/manage/course-instances/${courseInstanceId}/permissions`
}
