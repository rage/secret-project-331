/* eslint-disable i18next/no-literal-string */

import basePath from "./base-path"

export function courseMaterialPageHref(organizationSlug: string, courseSlug: string): string {
  return `/org/${organizationSlug}/courses/${courseSlug}`
}

export function organizationCoursesPageHref(organizationSlug: string): string {
  return `${basePath()}/org/${organizationSlug}`
}
