import type { CreditRegistrationAdminAction } from "@/generated/api/types.generated"

/** The audit actions the reason dialogs record under, which also pick the earlier reasons offered. */
export const AUDIT_ACTION = {
  ADD_NOTE: "add_note",
  DISMISS_ATTENTION: "dismiss_attention",
  DISMISS_STUDY_REGISTRY_CONFLICT: "dismiss_study_registry_conflict",
  MANUAL_LINK_STUDENT_NUMBER: "manual_link_student_number",
  PAUSE_COURSE_MODULE: "pause_course_module",
  PAUSE_PHASE: "pause_phase",
  REQUEUE_BATCH: "requeue_batch",
  RESEND_LINK_EMAIL: "resend_link_email",
  TRANSITION_ITEM: "transition_item",
  UNLINK_STUDENT_NUMBER: "unlink_student_number",
} as const satisfies Record<string, CreditRegistrationAdminAction>
