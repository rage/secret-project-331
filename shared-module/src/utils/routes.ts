/* eslint-disable i18next/no-literal-string */
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
