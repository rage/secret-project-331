import {
  creditRegistrationAuditRoute,
  creditRegistrationLinkingRoute,
  creditRegistrationSystemRoute,
} from "@/shared-module/common/utils/routes"

/** The id of a processing phase's row on the System tab. */
export const phaseAnchorId = (phase: string): string => `phase-${phase}`

/** A processing phase's row on the System tab. */
export const phaseHref = (phase: string): string =>
  `${creditRegistrationSystemRoute()}#${phaseAnchorId(phase)}`

/** The id of a course code's row in the Linking tab's course code table. */
export const courseCodeAnchorId = (courseCode: string): string => `course-code-${courseCode}`

/** A course code's row in the Linking tab's course code table. */
export const courseCodeHref = (courseCode: string): string =>
  `${creditRegistrationLinkingRoute()}#${courseCodeAnchorId(courseCode)}`

/** The Audit tab's parameter for every action about one student. */
export const AUDIT_USER_ID_PARAM = "user_id"

/** The Audit tab filtered to every action about one student. */
export const auditForStudentHref = (userId: string): string =>
  `${creditRegistrationAuditRoute()}?${new URLSearchParams({ [AUDIT_USER_ID_PARAM]: userId }).toString()}`
