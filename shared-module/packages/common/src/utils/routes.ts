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

export function manageChatbotRoute(chatbotId: string) {
  return `/manage/chatbots/${chatbotId}`
}

export function courseChatbotSettingsRoute(courseId: string) {
  return `/manage/courses/${courseId}/other/chatbot`
}
