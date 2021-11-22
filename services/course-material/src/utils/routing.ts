/* eslint-disable i18next/no-literal-string */

import basePath from "../shared-module/utils/base-path"

export function courseFrontPageRoute(organizationSlug: string, courseSlug: string) {
  return `/${organizationSlug}/courses/${courseSlug}`
}

export function courseFaqPageRoute(organizationSlug: string, courseSlug: string) {
  return `/${organizationSlug}/courses/${courseSlug}`
}

export function coursePageRoute(
  organizationSlug: string,
  courseSlug: string,
  relativePathWithSlash: string,
) {
  return `${basePath()}/${organizationSlug}/courses/${courseSlug}${relativePathWithSlash}`
}

export function coursePageSectionRoute(
  organizationSlug: string,
  courseSlug: string,
  relativePathWithSlash: string,
  anchor: string,
) {
  return `${basePath()}/${organizationSlug}/courses/${courseSlug}${relativePathWithSlash}#${anchor}`
}
