import { PageInfo } from "../bindings"

export function pageRoute(pageInfo: PageInfo, urlPath: string): string {
  return `/org/${pageInfo.organization_slug}/courses/${pageInfo.course_slug}${urlPath}`
}

export function manageCourseRoute(courseId: string) {
  return `/manage/courses/${courseId}`
}

export function manageCourseOverviewRoute(courseId: string) {
  return `/manage/courses/${courseId}/overview`
}

export function manageCoursePagesRoute(courseId: string) {
  return `/manage/courses/${courseId}/pages`
}

export function manageCourseModulesRoute(courseId: string) {
  return `/manage/courses/${courseId}/modules`
}

export function manageCourseFeedbackRoute(courseId: string) {
  return `/manage/courses/${courseId}/feedback`
}

export function manageCourseFeedbackUnreadRoute(courseId: string) {
  return `/manage/courses/${courseId}/feedback/unread`
}

export function manageCourseFeedbackReadRoute(courseId: string) {
  return `/manage/courses/${courseId}/feedback/read`
}

export function manageCourseChangeRequestsRoute(courseId: string) {
  return `/manage/courses/${courseId}/change-requests`
}

export function manageCourseChangeRequestsPendingRoute(courseId: string) {
  return `/manage/courses/${courseId}/change-requests/pending`
}

export function manageCourseChangeRequestsOldRoute(courseId: string) {
  return `/manage/courses/${courseId}/change-requests/old`
}

export function manageCourseExercisesRoute(courseId: string) {
  return `/manage/courses/${courseId}/exercises`
}

export function manageCourseInstancesRoute(courseId: string) {
  return `/manage/courses/${courseId}/course-instances`
}

export function manageCourseLanguageVersionsRoute(courseId: string) {
  return `/manage/courses/${courseId}/language-versions`
}

export function manageCoursePermissionsRoute(courseId: string) {
  return `/manage/courses/${courseId}/permissions`
}

export function organizationFrontPageRoute(organizationSlug: string) {
  return `/org/${organizationSlug}`
}

export function loginRoute(returnTo: string, language?: string) {
  const langParam = language ? `&lang=${language}` : ""
  return `/login?return_to=${encodeURIComponent(returnTo)}${langParam}`
}

export function signUpRoute(returnTo: string, language?: string) {
  const langParam = language ? `&lang=${language}` : ""
  return `/signup?return_to=${encodeURIComponent(returnTo)}${langParam}`
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

export function manageCourseStatsOverviewRoute(courseId: string) {
  return `/manage/courses/${courseId}/stats/overview`
}

export function manageCourseStatsUserActivityRoute(courseId: string) {
  return `/manage/courses/${courseId}/stats/user-activity`
}

export function manageCourseStatsVisitorsRoute(courseId: string) {
  return `/manage/courses/${courseId}/stats/visitors`
}

export function manageCourseStatsAllLanguagesRoute(courseId: string) {
  return `/manage/courses/${courseId}/stats/all-languages`
}

export function manageCourseStatsCountryStatsRoute(courseId: string) {
  return `/manage/courses/${courseId}/stats/country-stats`
}

export function manageCourseStatsCourseInstancesRoute(courseId: string) {
  return `/manage/courses/${courseId}/stats/course-instances`
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

export function manageCourseOtherReferencesRoute(courseId: string) {
  return `/manage/courses/${courseId}/other/references`
}

export function manageCourseOtherGlossaryRoute(courseId: string) {
  return `/manage/courses/${courseId}/other/glossary`
}

export function manageCourseOtherCheatersRoute(courseId: string) {
  return `/manage/courses/${courseId}/other/cheaters`
}

export function manageCourseOtherCheatersSuspectedRoute(courseId: string) {
  return `/manage/courses/${courseId}/other/cheaters/suspected`
}

export function manageCourseOtherCheatersArchivedRoute(courseId: string) {
  return `/manage/courses/${courseId}/other/cheaters/archived`
}

export function manageCourseOtherCodeGiveawaysRoute(courseId: string) {
  return `/manage/courses/${courseId}/other/code-giveaways`
}

export function manageCourseOtherExerciseResetToolRoute(courseId: string) {
  return `/manage/courses/${courseId}/other/exercise-reset-tool`
}

export function manageCourseByIdRoute(courseId: string) {
  return `/manage/courses/${courseId}`
}

export function navigateToCourseRoute(organizationSlug: string, courseSlug: string) {
  return `/org/${organizationSlug}/courses/${courseSlug}`
}

export function courseUserStatusSummaryRoute(courseId: string, userId: string) {
  return `/manage/courses/${courseId}/user-status-summary/${userId}`
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

export function examRoute(organizationSlug: string, examId: string) {
  return `/org/${organizationSlug}/exams/${examId}`
}

export function manageExamRoute(examId: string) {
  return `/manage/exams/${examId}`
}

export function manageExamQuestionsRoute(examId: string) {
  return `/manage/exams/${examId}/questions`
}

export function testExamRoute(organizationSlug: string, examId: string) {
  return `/org/${organizationSlug}/exams/testexam/${examId}`
}

export function manageUserRoute(userId: string) {
  return `/manage/users/${userId}`
}

export function manageRegradingRoute(regradingId: string) {
  return `/manage/regradings/${regradingId}`
}

export function exerciseAnswersRequiringAttentionRoute(exerciseId: string) {
  return `/manage/exercises/${exerciseId}/answers-requiring-attention`
}

export function exerciseExamSubmissionsRoute(exerciseId: string) {
  return `/manage/exercises/${exerciseId}/exam-submissions`
}

export function userSettingsRoute() {
  return "/user-settings/account"
}
