import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import {
  getAllCoursesOptions,
  getOrganizationCoursesOptions,
  getOrganizationsOptions,
} from "@/generated/api/@tanstack/react-query.generated"

import {
  type ClosingSuccessorCandidate,
  toClosingSuccessorCandidate,
} from "./closingSuccessorCandidates"

// Backend maximum; the endpoint is paginated and the dropdown needs every course.
const ORGANIZATION_COURSES_LIMIT = 10_000

interface ClosingSuccessorCandidates {
  candidates: ClosingSuccessorCandidate[]
  isLoading: boolean
}

/** Courses of one organization, for course managers. */
export const useOrganizationClosingSuccessorCandidates = (
  organizationId: string,
  enabled = true,
): ClosingSuccessorCandidates => {
  const coursesQuery = useQuery({
    ...getOrganizationCoursesOptions({
      path: { organization_id: organizationId },
      query: { limit: ORGANIZATION_COURSES_LIMIT },
    }),
    enabled,
  })
  const candidates = useMemo(
    () => (coursesQuery.data ?? []).map((course) => toClosingSuccessorCandidate(course, "")),
    [coursesQuery.data],
  )
  return { candidates, isLoading: coursesQuery.isLoading }
}

/** Courses across all organizations; global admins only. */
export const useAllClosingSuccessorCandidates = (enabled = true): ClosingSuccessorCandidates => {
  const coursesQuery = useQuery({ ...getAllCoursesOptions(), enabled })
  const organizationsQuery = useQuery({ ...getOrganizationsOptions(), enabled })
  const candidates = useMemo(() => {
    const organizationNames = new Map(
      (organizationsQuery.data ?? []).map((organization) => [organization.id, organization.name]),
    )
    return (coursesQuery.data ?? []).map((course) =>
      toClosingSuccessorCandidate(course, organizationNames.get(course.organization_id) ?? ""),
    )
  }, [coursesQuery.data, organizationsQuery.data])
  return { candidates, isLoading: coursesQuery.isLoading || organizationsQuery.isLoading }
}
