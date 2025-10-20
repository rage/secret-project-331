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
  if (organizationSlug === null || organizationSlug === undefined || organizationSlug === "") {
    throw new Error("Cannot build course page route without an organization slug")
  }
  if (courseSlug === null || courseSlug === undefined || courseSlug === "") {
    throw new Error("Cannot build course page route without a course slug")
  }
  if (relativePathWithSlash === null || relativePathWithSlash === undefined) {
    throw new Error("Cannot build course page route without a relative path")
  }
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
