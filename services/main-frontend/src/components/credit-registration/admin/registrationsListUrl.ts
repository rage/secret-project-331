import type {
  CreditRegistrationAttentionReason,
  CreditRegistrationErrorCode,
  CreditRegistrationState,
  Engagement,
  TimelineStep,
} from "@/generated/api/types.generated"
import { creditRegistrationRegistrationsRoute } from "@/shared-module/common/utils/routes"

/** The Registrations tab's query parameters; its filters read the same names. */
export const REGISTRATIONS_PARAM = {
  step: "step",
  engagement: "engagement",
  includeNotStarted: "include_not_started",
  needsAttention: "needs_attention",
  attentionReason: "attention_reason",
  state: "state",
  errorCode: "error_code",
  courseId: "course_id",
  courseModuleId: "course_module_id",
  userId: "user_id",
  studentNumber: "student_number",
  search: "search",
  includeSuperseded: "include_superseded",
  sort: "sort",
} as const

const TRUE = "true"

/** What a link into the Registrations tab narrows it to. */
export interface RegistrationsListFilter {
  steps?: readonly TimelineStep[]
  engagements?: readonly Engagement[]
  includeNotStarted?: boolean
  needsAttention?: boolean
  attentionReasons?: readonly CreditRegistrationAttentionReason[]
  states?: readonly CreditRegistrationState[]
  errorCodes?: readonly CreditRegistrationErrorCode[]
  courseId?: string
  courseModuleId?: string
  userId?: string
}

/**
 * The Registrations tab filtered to exactly the rows a count stands for. Every count on the
 * dashboard links through this, so a count and its list cannot drift apart.
 *
 * Not started rows are left out of the list by default, so asking for them turns them on.
 */
export const registrationsListHref = (filter: RegistrationsListFilter): string => {
  const params = new URLSearchParams()
  const appendAll = (name: string, values: readonly string[] | undefined) =>
    values?.forEach((value) => params.append(name, value))
  appendAll(REGISTRATIONS_PARAM.step, filter.steps)
  appendAll(REGISTRATIONS_PARAM.engagement, filter.engagements)
  if (filter.includeNotStarted || filter.engagements?.includes("not_started")) {
    params.set(REGISTRATIONS_PARAM.includeNotStarted, TRUE)
  }
  if (filter.needsAttention) {
    params.set(REGISTRATIONS_PARAM.needsAttention, TRUE)
  }
  appendAll(REGISTRATIONS_PARAM.attentionReason, filter.attentionReasons)
  appendAll(REGISTRATIONS_PARAM.state, filter.states)
  appendAll(REGISTRATIONS_PARAM.errorCode, filter.errorCodes)
  if (filter.courseId) {
    params.set(REGISTRATIONS_PARAM.courseId, filter.courseId)
  }
  if (filter.courseModuleId) {
    params.set(REGISTRATIONS_PARAM.courseModuleId, filter.courseModuleId)
  }
  if (filter.userId) {
    params.set(REGISTRATIONS_PARAM.userId, filter.userId)
  }
  const query = params.toString()
  return query === ""
    ? creditRegistrationRegistrationsRoute()
    : `${creditRegistrationRegistrationsRoute()}?${query}`
}
