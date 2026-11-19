import type { Locator, Page } from "@playwright/test"

/**
 * A course set of `seed_language_versions.rs`: a Finnish course, its Swedish language version
 * (one page missing, two pages linked to the same page, chapter 1 in another order) and an
 * English course copied from it as a separate course. Ids mirror `LANGUAGE_VERSION_SETS` there.
 */
export interface LanguageVersionSet {
  label: string
  organizationSlug: string
  finnishCourseId: string
  /** "Kertaus", the Finnish page that has no Swedish counterpart. */
  reviewPageId: string
  finnishName: string
  englishName: string
  swedishName: string
  finnishSlug: string
  englishSlug: string
  swedishSlug: string
  teacherEmail: string
  /** Enrolled in the Finnish and the English course, with exercise activity in the English one. */
  studentInBothEmail: string
}

function languageVersionSet(
  label: string,
  finnishCourseId: string,
  reviewPageId: string,
): LanguageVersionSet {
  return {
    label,
    organizationSlug: `language-versions-${label}`,
    finnishCourseId,
    reviewPageId,
    finnishName: `Ohjelmoinnin perusteet (${label})`,
    englishName: `Programming basics (${label})`,
    swedishName: `Grunderna i programmering (${label})`,
    finnishSlug: `ohjelmoinnin-perusteet-${label}`,
    englishSlug: `programming-basics-${label}`,
    swedishSlug: `grunderna-i-programmering-${label}`,
    teacherEmail: `lv-${label}-teacher@example.com`,
    studentInBothEmail: `lv-${label}-student-1@example.com`,
  }
}

export const PROBLEMS_SET = languageVersionSet(
  "problems",
  "8ef160e5-895c-41ee-b4a1-4b98a7054edb",
  "ed01ac2d-b122-4e4c-b113-f1e20344b0e6",
)
export const JOIN_SET = languageVersionSet(
  "join",
  "8ec3d906-0231-49dd-9f54-5be70b52c3a5",
  "263d6954-faf3-44f9-9f00-0c640c363f6b",
)
export const SPLIT_SET = languageVersionSet(
  "split",
  "586fa030-e93a-4264-91ad-6c1bfd9c0bdb",
  "89ab1b7d-f42d-4ffe-8123-9560923119c1",
)
export const ADMIN_SET = languageVersionSet(
  "admin",
  "261fe65f-c1dc-4dd7-b01b-10b440646803",
  "83f90419-8b19-428e-aa44-7872cfdc62cb",
)

/**
 * The seeded users some spec signs in as; `global.setup.spec.ts` stores their sessions. Each
 * password is the address's local part.
 */
export const LANGUAGE_VERSION_USER_EMAILS = [
  PROBLEMS_SET.teacherEmail,
  JOIN_SET.teacherEmail,
  JOIN_SET.studentInBothEmail,
  SPLIT_SET.teacherEmail,
]

/** Stored session of one of {@link LANGUAGE_VERSION_USER_EMAILS}, for `test.use({ storageState })`. */
export const storageStateOf = (email: string): string => `src/states/${email}.json`

export const languageVersionsTabUrl = (courseId: string): string =>
  `/manage/courses/${courseId}/language-versions`

export const coursePageUrl = (set: LanguageVersionSet, courseSlug: string, path: string): string =>
  `/org/${set.organizationSlug}/courses/${courseSlug}${path}`

/** The row of the problem whose headline is `title` in the tool's problem list. */
export const problemRow = (page: Page, title: string): Locator =>
  page.getByRole("listitem").filter({ has: page.getByText(title, { exact: true }) })
