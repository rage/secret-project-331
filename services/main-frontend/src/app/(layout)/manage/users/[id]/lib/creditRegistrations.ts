import { type UseQueryResult, useQueries } from "@tanstack/react-query"
import { useMemo } from "react"

import { getCourseCreditRegistrationsForUsers } from "@/generated/api/sdk.generated"
import type {
  CourseCreditRegistration,
  CourseEnrollmentInfo,
  StudentNumberVerificationMethod,
  TeacherLinkingEmailStatus,
} from "@/generated/api/types.generated"
import type { ActionOnResource } from "@/shared-module/common/authApiTypes"
import useAuthorizeMultiple from "@/shared-module/common/hooks/useAuthorizeMultiple"

// The key shape `useTeacherCreditRegistrations` builds, so the retry actions in the shared details
// dialog — which invalidate `[prefix, courseId]` — refresh this page too.
const QUERY_KEY_PREFIX = "course-credit-registrations/by-user-ids"

const VIEW_CREDIT_REGISTRATIONS = { type: "view_and_manage_credit_registrations" } as const

/** The student's registrations, and which courses the viewer is allowed to know anything about. */
export interface UserCreditRegistrations {
  /** Newest live registration per module, grouped by course. */
  byCourseId: Map<string, CourseCreditRegistration[]>
  /**
   * Courses whose registrations the viewer may read. A course outside this set must render nothing
   * registration-related: a registration carries the student's Sisu identity, which the permission
   * that opens this page does not by itself grant.
   */
  visibleCourseIds: Set<string>
}

/** Module scope keeps the reference stable, which is what lets `useQueries` memoize the result. */
const groupLiveRegistrations = (
  results: UseQueryResult<CourseCreditRegistration[]>[],
): Map<string, CourseCreditRegistration[]> => {
  const byCourseId = new Map<string, CourseCreditRegistration[]>()
  for (const result of results) {
    for (const row of result.data ?? []) {
      if (row.superseded) {
        continue
      }
      const forCourse = byCourseId.get(row.course_id) ?? []
      forCourse.push(row)
      byCourseId.set(row.course_id, forCourse)
    }
  }
  return byCourseId
}

/**
 * Every credit registration the student has across the courses they are enrolled in.
 *
 * Only courses the student has a module completion in are requested, since a registration exists
 * per completion — so an account enrolled in dozens of courses costs one request per completed
 * course rather than one per row, and the collapsed enrolment rows can carry a tally without
 * anyone expanding them.
 */
export const useUserCreditRegistrations = (
  userId: string,
  enrollments: CourseEnrollmentInfo[],
): UserCreditRegistrations => {
  const completedCourseIds = useMemo(
    () =>
      enrollments
        .filter((enrollment) => enrollment.course_module_completions.length > 0)
        .map((enrollment) => enrollment.course_id),
    [enrollments],
  )

  const authorizeRequests: ActionOnResource[] = useMemo(
    () =>
      completedCourseIds.map((id) => ({
        action: VIEW_CREDIT_REGISTRATIONS,
        resource: { type: "course", id },
      })),
    [completedCourseIds],
  )
  const permissions = useAuthorizeMultiple(authorizeRequests).data

  const visibleCourseIds = useMemo(
    () => new Set(completedCourseIds.filter((_, index) => permissions?.[index] === true)),
    [completedCourseIds, permissions],
  )

  const byCourseId = useQueries({
    queries: [...visibleCourseIds].map((courseId) => ({
      queryKey: [QUERY_KEY_PREFIX, courseId, [userId]],
      queryFn: () =>
        getCourseCreditRegistrationsForUsers({
          path: { course_id: courseId },
          body: { user_ids: [userId] },
        }),
    })),
    combine: groupLiveRegistrations,
  })

  return useMemo(() => ({ byCourseId, visibleCourseIds }), [byCourseId, visibleCourseIds])
}

/** One course's registrations keyed by module, or null when there is nothing to show for it. */
export const registrationsByModuleId = (
  registrations: UserCreditRegistrations,
  courseId: string,
): Map<string, CourseCreditRegistration> | null => {
  if (!registrations.visibleCourseIds.has(courseId)) {
    return null
  }
  const rows = registrations.byCourseId.get(courseId) ?? []
  return rows.length > 0 ? new Map(rows.map((row) => [row.course_module_id, row])) : null
}

/** How a set of registrations stands, in the terms a collapsed row and the stat tiles count in. */
export interface CreditRegistrationTally {
  /** Registrations that exist at all — the denominator of "n of m registered". */
  total: number
  registered: number
  failed: number
}

export const tallyRegistrations = (
  rows: Iterable<CourseCreditRegistration>,
): CreditRegistrationTally => {
  const tally: CreditRegistrationTally = { total: 0, registered: 0, failed: 0 }
  for (const row of rows) {
    tally.total += 1
    if (row.student_facing_status === "registered") {
      tally.registered += 1
    } else if (row.student_facing_status === "failed") {
      tally.failed += 1
    }
  }
  return tally
}

/** The Sisu identity the student's credits are being registered under, as far as this page knows. */
export interface StudentNumberState {
  /** Null until a number is confirmed; the credits wait in the pipeline until then. */
  studentNumber: string | null
  verifiedVia: StudentNumberVerificationMethod | null
  /** Our own send status for the confirmation link, present only while nothing is linked. */
  linkingEmail: TeacherLinkingEmailStatus | null
}

/**
 * The student number to show in the identity header, or null when no registration says anything
 * about one — including when the viewer may not read registrations at all.
 *
 * A confirmed number is the same on every registration, so the first one carrying it wins.
 */
export const studentNumberFrom = (
  registrations: UserCreditRegistrations,
): StudentNumberState | null => {
  const rows = [...registrations.byCourseId.values()].flat()
  if (rows.length === 0) {
    return null
  }
  const linked = rows.find((row) => row.student_number)
  if (linked?.student_number) {
    return {
      studentNumber: linked.student_number,
      verifiedVia: linked.student_number_verified_via ?? null,
      linkingEmail: null,
    }
  }
  return {
    studentNumber: null,
    verifiedVia: null,
    linkingEmail: rows.find((row) => row.linking_email)?.linking_email ?? null,
  }
}
