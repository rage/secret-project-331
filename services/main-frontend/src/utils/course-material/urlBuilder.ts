/**
 * Utility functions for building and parsing course URLs.
 * Provides a centralized way to handle URL construction and validation.
 */

interface CourseUrlParts {
  origin: string
  organizationSlug: string
  courseSlug: string
  pagePath: string
}

interface ParsedCourseUrl {
  organizationSlug: string | null
  courseSlug: string | null
  pagePath: string | null
}

/**
 * Builds a complete course URL from its components.
 */
export function buildCourseUrl({
  origin,
  organizationSlug,
  courseSlug,
  pagePath,
}: CourseUrlParts): string {
  const cleanPagePath = pagePath.startsWith("/") ? pagePath : `/${pagePath}`
  return `${origin}/org/${organizationSlug}/courses/${courseSlug}${cleanPagePath}`
}

/**
 * Parses a course URL to extract its components.
 * More robust than manual string splitting.
 */
export function parseCourseUrl(url: string): ParsedCourseUrl {
  try {
    const urlObj = new URL(url)
    const pathSegments = urlObj.pathname ? urlObj.pathname.split("/").filter(Boolean) : []

    // Expected pattern: /org/{orgSlug}/courses/{courseSlug}/{...pagePath}
    if (pathSegments.length < 4 || pathSegments[0] !== "org" || pathSegments[2] !== "courses") {
      throw new Error("Invalid course URL structure")
    }

    const [, organizationSlug, , courseSlug, ...pagePathSegments] = pathSegments

    return {
      organizationSlug,
      courseSlug,
      pagePath: pagePathSegments.length > 0 ? `/${pagePathSegments.join("/")}` : "/",
    }
  } catch (error) {
    console.error("Failed to parse course URL:", error)
    return {
      organizationSlug: null,
      courseSlug: null,
      pagePath: null,
    }
  }
}

/**
 * Validates that a URL follows the expected course URL pattern.
 */
export function isValidCourseUrl(url: string): boolean {
  const parsed = parseCourseUrl(url)
  return !!(parsed.organizationSlug && parsed.courseSlug)
}

/**
 * Builds a language-switched URL using existing URL parts and new course data.
 */
export function buildLanguageSwitchedUrl(
  currentUrl: string,
  newCourseSlug: string,
  newPagePath: string,
): string {
  const parsed = parseCourseUrl(currentUrl)

  if (!parsed.organizationSlug || !parsed.courseSlug) {
    throw new Error("Invalid course URL structure")
  }

  return buildCourseUrl({
    origin: new URL(currentUrl).origin,
    organizationSlug: parsed.organizationSlug,
    courseSlug: newCourseSlug,
    pagePath: newPagePath,
  })
}

/**
 * Normalizes URLs for comparison by ensuring consistent trailing slash handling.
 */
export function normalizeUrl(url: string): string {
  return url.endsWith("/") ? url : `${url}/`
}
