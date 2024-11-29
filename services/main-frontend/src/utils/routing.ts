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

export function managePartnersBlockPageRoute(courseId: string) {
  return `/manage/courses/${courseId}/partners-block`
}

export function manageCourseInstancePermissionsPageRoute(courseInstanceId: string) {
  return `/manage/course-instances/${courseInstanceId}/permissions`
}

export function viewCourseInstanceCompletionsPageRoute(courseInstanceId: string) {
  return `/manage/course-instances/${courseInstanceId}/completions`
}

export function viewCourseInstancePointsPageRoute(courseInstanceId: string) {
  return `/manage/course-instances/${courseInstanceId}/points`
}

export function viewCourseInstanceCertificatesPageRoute(courseInstanceId: string) {
  return `/manage/course-instances/${courseInstanceId}/certificates`
}
