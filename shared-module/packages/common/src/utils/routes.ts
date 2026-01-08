import { PageInfo } from "../bindings"

export function pageRoute(pageInfo: PageInfo, urlPath: string): string {
  return `/org/${pageInfo.organization_slug}/courses/${pageInfo.course_slug}${urlPath}`
}

export function manageCourseRoute(courseId: string) {
  return `/manage/courses/${courseId}`
}

export function organizationFrontPageRoute(organizationSlug: string) {
  return `/org/${organizationSlug}`
}

export function loginRoute(returnTo: string) {
  return `/login?return_to=${encodeURIComponent(returnTo)}`
}

export function signUpRoute(returnTo: string) {
  return `/signup?return_to=${encodeURIComponent(returnTo)}`
}

export function manageExerciseServicesRoute() {
  return "/manage/exercise-services"
}

export function manageOrganizationRoute(organizationId: string) {
  return `/manage/organizations/${organizationId}`
}

export function searchUsersRoute() {
  return "/manage/search-users"
}

export function globalPermissionsRoute() {
  return "/manage/permissions"
}

export function globalStatsRoute() {
  return "/stats"
}

export function domainStatsRoute() {
  return "/domain-stats"
}

export function courseStatsRoute(courseId: string) {
  return `/manage/courses/${courseId}/stats`
}

export function allOrganizationsRoute() {
  return "/organizations"
}

export function editCourseDefaultPeerOrSelfReviewConfigRoute(courseId: string) {
  return `/cms/courses/${courseId}/default-peer-review`
}

export function regradingsRoute() {
  return "/manage/regradings"
}

export function codeGiveawayRoute(codeGiveawayId: string) {
  return `/manage/code-giveaways/${codeGiveawayId}`
}

export function manageCourseExercisesRoute(courseId: string) {
  return `/manage/courses/${courseId}/exercises`
}

export function manageCourseStudentsRoute(courseId: string, subtab?: string) {
  const base = `/manage/courses/${courseId}/students`
  return subtab ? `${base}/${subtab}` : base
}

export function manageChatbotRoute(chatbotId: string) {
  return `/manage/chatbots/${chatbotId}`
}

export function courseChatbotSettingsRoute(courseId: string) {
  return `/manage/courses/${courseId}/other/chatbot`
}

export function manageCourseByIdRoute(courseId: string) {
  return `/manage/courses/${courseId}`
}

export function navigateToCourseRoute(organizationSlug: string, courseSlug: string) {
  return `/org/${organizationSlug}/courses/${courseSlug}`
}

export function courseInstanceUserStatusSummaryRoute(courseInstanceId: string, userId: string) {
  return `/manage/course-instances/${courseInstanceId}/course-status-summary-for-user/${userId}`
}

export function exerciseSubmissionsRoute(exerciseId: string) {
  return `/manage/exercises/${exerciseId}/submissions`
}

export function submissionGradingRoute(submissionId: string) {
  return `/submissions/${submissionId}/grading/`
}

export function courseFrontPageRoute(organizationSlug: string, courseSlug: string) {
  return `/org/${organizationSlug}/courses/${courseSlug}`
}

export function courseFaqPageRoute(organizationSlug: string, courseSlug: string) {
  return `/org/${organizationSlug}/courses/${courseSlug}`
}

export function coursePageRoute(
  organizationSlug: string,
  courseSlug: string,
  relativePathWithSlash: string,
) {
  if (organizationSlug === null || organizationSlug === undefined || organizationSlug === "") {
    throw new Error("Cannot build course page route without an organization slug")
  }
  if (courseSlug === null || courseSlug === undefined || courseSlug === "") {
    throw new Error("Cannot build course page route without a course slug")
  }
  if (relativePathWithSlash === null || relativePathWithSlash === undefined) {
    throw new Error("Cannot build course page route without a relative path")
  }
  return `/org/${organizationSlug}/courses/${courseSlug}${relativePathWithSlash}`
}

export function coursePageSectionRoute(
  organizationSlug: string,
  courseSlug: string,
  relativePathWithSlash: string,
  anchor: string,
) {
  return `/org/${organizationSlug}/courses/${courseSlug}${relativePathWithSlash}#${anchor}`
}

export function accountDeletedRoute() {
  return "/account-deleted"
}

export function editPageRoute(pageId: string) {
  return `/cms/pages/${pageId}`
}
