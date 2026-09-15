"use client"

import { useQuery } from "@tanstack/react-query"

import { getMyEmailVerificationStatusOptions } from "@/generated/api/@tanstack/react-query.generated"

/**
 * Whether this account can still prove its own email address.
 *
 * The fast track to a linked student number: an address the study registry also holds links the
 * number with no confirmation mail at all, which is the only lever a student has over
 * `needs_student_number` — resending the mail is a teacher's or support's action, not theirs.
 */
export const useCanConfirmEmailAddress = (): boolean => {
  const status = useQuery({ ...getMyEmailVerificationStatusOptions() }).data
  return (
    status?.verification_enabled === true && status.template_configured && !status.email_verified_at
  )
}
