// These hrefs are used to link between different microservices. They should only be used with the
// `<a>` element and not with `next/router`.

export function courseMaterialFrontPageHref(organizationSlug: string, courseSlug: string): string {
  return `/org/${organizationSlug}/courses/${courseSlug}`
}

export function organizationCoursesPageHref(organizationSlug: string): string {
  return `/org/${organizationSlug}`
}
