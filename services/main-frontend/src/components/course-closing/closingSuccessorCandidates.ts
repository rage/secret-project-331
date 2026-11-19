import type { Course } from "@/generated/api/types.generated"

/** A course that can be named as the newer version of a closing course. */
export interface ClosingSuccessorCandidate {
  id: string
  name: string
  slug: string
  languageCode: string
  isDraft: boolean
  isUnlisted: boolean
  isClosed: boolean
  organizationId: string
  organizationName: string
}

export const toClosingSuccessorCandidate = (
  course: Course,
  organizationName: string,
  now: Date = new Date(),
): ClosingSuccessorCandidate => ({
  id: course.id,
  name: course.name,
  slug: course.slug,
  languageCode: course.language_code,
  isDraft: course.is_draft,
  isUnlisted: course.is_unlisted,
  isClosed: Boolean(course.closed_at) && new Date(course.closed_at as string) <= now,
  organizationId: course.organization_id,
  organizationName,
})
