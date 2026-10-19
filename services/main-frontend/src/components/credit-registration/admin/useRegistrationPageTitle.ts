"use client"

import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import type {
  AdminCreditRegistrationDetails,
  AdminCreditRegistrationRow,
  CreditRegistrationEventKind,
} from "@/generated/api/types.generated"
import { useIsDocumentHidden } from "@/shared-module/common/hooks/useIsDocumentHidden"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { usePageTitleChangeMarker } from "@/shared-module/common/hooks/usePageTitleChangeMarker"
import { joinTitleSegments } from "@/shared-module/common/utils/pageTitle"

import { CREDIT_REGISTRATION_NS } from "../constants"
import { adminLedgerStateLabel } from "./adminCreditRegistrationCopy"

const PART_SEPARATOR = " · "
/** Above the credit registration layout's tab title (20), which would otherwise win. */
const TITLE_ORDER = 30

/** "Matti M.": enough to tell a row of tabs apart without spelling out the whole name. */
const shortStudentName = (row: AdminCreditRegistrationRow): string | null => {
  const firstName = row.first_name?.trim()
  const lastName = row.last_name?.trim()
  if (firstName && lastName) {
    return `${firstName} ${lastName.charAt(0)}.`
  }
  return firstName || lastName || row.email?.split("@")[0]?.trim() || null
}

/** Every same-state Suotar check and retry writes one of these, so they are routine, not news. */
const ROUTINE_EVENT_KINDS: ReadonlySet<CreditRegistrationEventKind> = new Set([
  "suotar_response",
  "retry_scheduled",
])

/** What counts as the registration changing. Not `state_entered_at`: every same-state check bumps it. */
const changeFingerprint = (details: AdminCreditRegistrationDetails): string => {
  const row = details.registration
  return JSON.stringify([
    details.events.filter((event) => !ROUTINE_EVENT_KINDS.has(event.kind)).length,
    row.state,
    row.state_changed_at,
    row.phase,
    row.needs_admin_attention,
    row.attention_reasons,
    row.error_code ?? null,
    details.notification_emails.length,
    details.linking_emails.length,
    details.actions.length,
  ])
}

/**
 * Titles the registration's tab "Matti M. · TKT21018 · Waiting for enrolment", and marks it while
 * the registration changes in a hidden tab.
 *
 * The marker compares against the registration as it was when the tab was last visible, so the
 * admin's own actions never set it.
 */
export function useRegistrationPageTitle(
  details: AdminCreditRegistrationDetails | undefined,
  isNotFound: boolean,
): void {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const row = details?.registration

  let title: string | null = null
  if (row) {
    title = joinTitleSegments(
      [
        shortStudentName(row) ?? t("credit-registration-admin-title-registration"),
        row.uh_course_code,
        adminLedgerStateLabel(t, row.state, row.pending_reason),
      ],
      PART_SEPARATOR,
    )
  } else if (isNotFound) {
    title = t("credit-registration-admin-title-registration-not-found")
  }
  usePageTitle(title && joinTitleSegments([title, t("credit-registration-tab-registrations")]), {
    order: TITLE_ORDER,
  })

  const isHidden = useIsDocumentHidden()
  const fingerprint = details ? changeFingerprint(details) : null
  const [visibleFingerprint, setVisibleFingerprint] = useState<string | null>(null)
  useEffect(() => {
    if (!isHidden) {
      setVisibleFingerprint(fingerprint)
    }
  }, [isHidden, fingerprint])
  usePageTitleChangeMarker(
    isHidden && visibleFingerprint !== null && fingerprint !== visibleFingerprint,
  )
}
