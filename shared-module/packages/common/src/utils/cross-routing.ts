// These are main-frontend's own `/org/...` routes; link to them with `Link`, not a plain `<a>`.

export function courseMaterialFrontPageHref(organizationSlug: string, courseSlug: string): string {
  return `/org/${organizationSlug}/courses/${courseSlug}`
}

export function organizationCoursesPageHref(organizationSlug: string): string {
  return `/org/${organizationSlug}`
}
