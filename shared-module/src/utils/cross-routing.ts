/* eslint-disable i18next/no-literal-string */

// These hrefs are used to link between different microservices. They should only be used with the
// `<a>` element and not with `next/router`.

export function courseMaterialPageHref(organizationSlug: string, courseSlug: string): string {
  return `/org/${organizationSlug}/courses/${courseSlug}`
}

export function organizationCoursesPageHref(organizationSlug: string): string {
  return `/org/${organizationSlug}`
}
