import type {
  AdminAttentionThresholds,
  AdminCreditRegistrationRow,
} from "@/generated/api/types.generated"

import type { CreditRegistrationTFunction } from "../constants"
import { formatZonedTimestamp } from "../ZonedTimestamp"

const SECONDS_PER_DAY = 86_400

const timestamp = (at: string): string => formatZonedTimestamp(new Date(at))

const elapsedSecs = (since: string, now: number): number => (now - new Date(since).getTime()) / 1000

const durationLabel = (t: CreditRegistrationTFunction, secs: number): string =>
  t("credit-registration-admin-duration-days", { count: Math.round(secs / SECONDS_PER_DAY) })

const isPolling = (row: AdminCreditRegistrationRow): boolean =>
  row.state === "awaiting_verification" || row.state === "submission_uncertain"

/** One sentence per sub-situation the state alone does not explain. */
export const subStateExplanations = (
  t: CreditRegistrationTFunction,
  row: AdminCreditRegistrationRow,
  thresholds: AdminAttentionThresholds,
  now: number,
): string[] => {
  if (row.superseded || row.terminal_at) {
    return []
  }
  const lines: string[] = []
  if (row.state === "awaiting_verification" && row.partially_registered_at) {
    lines.push(
      t("credit-registration-admin-substate-partial", {
        since: timestamp(row.partially_registered_at),
        after: durationLabel(t, thresholds.partial_registration_secs),
      }),
    )
  }
  if (
    isPolling(row) &&
    row.resubmit_not_before &&
    new Date(row.resubmit_not_before).getTime() > now
  ) {
    lines.push(
      t("credit-registration-admin-substate-pending", {
        until: timestamp(row.resubmit_not_before),
      }),
    )
  }
  if (row.not_registered_reimport_count > 0) {
    lines.push(
      t("credit-registration-admin-substate-resending", {
        count: row.not_registered_reimport_count,
        threshold: thresholds.not_registered_reimports,
      }),
    )
  }
  if (row.state === "submission_uncertain") {
    lines.push(
      t("credit-registration-admin-substate-uncertain", {
        after: durationLabel(t, thresholds.uncertain_secs),
      }),
    )
  }
  if (row.is_waiting_for_enrolment) {
    const parts: string[] = []
    if (row.no_usable_enrolment_since) {
      parts.push(
        t("credit-registration-admin-substate-enrolment-since", {
          since: timestamp(row.no_usable_enrolment_since),
        }),
      )
    }
    if (row.enrolment_checked_at) {
      parts.push(
        t("credit-registration-admin-substate-enrolment-checked", {
          checked: timestamp(row.enrolment_checked_at),
        }),
      )
    }
    if (row.enrolment_checks_stopped_at) {
      parts.push(
        t("credit-registration-admin-substate-enrolment-stopped", {
          stopped: timestamp(row.enrolment_checks_stopped_at),
        }),
      )
    } else if (row.enrolment_check_due_at) {
      parts.push(
        t("credit-registration-admin-substate-enrolment-next", {
          next: timestamp(row.enrolment_check_due_at),
        }),
      )
    }
    if (parts.length > 0) {
      lines.push(parts.join(" "))
    }
  }
  return lines
}

/** Why a flagged row needs a human, worked out from the row's own facts; generic when none applies. */
export const attentionReasonLabel = (
  t: CreditRegistrationTFunction,
  row: AdminCreditRegistrationRow,
  thresholds: AdminAttentionThresholds,
  now: number,
): string => {
  const submittedFor = row.submitted_at ? elapsedSecs(row.submitted_at, now) : 0
  if (
    row.state === "awaiting_verification" &&
    row.partially_registered_at &&
    elapsedSecs(row.partially_registered_at, now) >= thresholds.partial_registration_secs
  ) {
    return t("credit-registration-admin-attention-partial", {
      after: durationLabel(t, thresholds.partial_registration_secs),
    })
  }
  if (isPolling(row) && submittedFor >= thresholds.verify_window_secs) {
    return t("credit-registration-admin-attention-window-expired", {
      after: durationLabel(t, thresholds.verify_window_secs),
    })
  }
  if (row.state === "submission_uncertain" && submittedFor >= thresholds.uncertain_secs) {
    return t("credit-registration-admin-attention-uncertain", {
      after: durationLabel(t, thresholds.uncertain_secs),
    })
  }
  if (row.not_registered_reimport_count >= thresholds.not_registered_reimports) {
    return t("credit-registration-admin-attention-resent", {
      count: row.not_registered_reimport_count,
    })
  }
  return t("credit-registration-admin-attention-generic")
}
