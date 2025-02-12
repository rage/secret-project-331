// NOTE: the urls in this file don't have the base path in the beginning (i.e. /org) because when links are used with next/link, the base path is automatically added

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
  return `/${organizationSlug}/courses/${courseSlug}${relativePathWithSlash}`
}

export function coursePageSectionRoute(
  organizationSlug: string,
  courseSlug: string,
  relativePathWithSlash: string,
  anchor: string,
) {
  return `/${organizationSlug}/courses/${courseSlug}${relativePathWithSlash}#${anchor}`
}
