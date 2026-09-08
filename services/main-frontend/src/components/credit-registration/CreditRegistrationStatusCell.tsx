"use client"

import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import type { CourseCreditRegistration } from "@/generated/api/types.generated"
import { RegistrationStatusBadge } from "@/shared-module/components"
import { ChevronIcon } from "@/shared-module/components/components/primitives/ChevronIcon"

import { BADGE_COMPACT, CREDIT_REGISTRATION_NS } from "./constants"
import type { CreditRegistrationTFunction } from "./constants"
import {
  registrationErrorShortLabel,
  registrationLedgerStateLabel,
  registrationStatusState,
  registrationStatusTeacherLabel,
} from "./creditRegistrationCopy"
import CreditRegistrationDetailsDialog from "./CreditRegistrationDetailsDialog"
import { linkingEmailShortLabel } from "./teacherCreditRegistrations"

interface Props {
  registration: CourseCreditRegistration
}

/** The badge's padding, its icon and the chevron, none of which text measurement can see. */
export const CREDIT_REGISTRATION_CELL_CHROME_PX = 46

/**
 * The second line of the cell: what is holding this particular registration up.
 *
 * Each status has its own kind of reason, and only its own: an error code left over from an
 * earlier attempt would otherwise print a failure under a pill that says the row is still waiting.
 */
const reasonLine = (
  t: CreditRegistrationTFunction,
  registration: CourseCreditRegistration,
  locale: string,
): string | null => {
  switch (registration.student_facing_status) {
    case "failed":
      return registrationErrorShortLabel(t, registration.error_code)
    case "needs_student_number":
      return linkingEmailShortLabel(t, registration.linking_email, locale)
    case "not_registering":
      return registrationLedgerStateLabel(t, registration.state)
    default:
      return null
  }
}

/**
 * The widest line this cell will render, for the off-DOM column measurement that decides how much
 * room the column gets. Without it the column falls back to its minimum and clips the badge.
 */
export const creditRegistrationCellText = (
  t: CreditRegistrationTFunction,
  registration: CourseCreditRegistration | undefined,
  locale: string,
): string => {
  if (!registration) {
    return ""
  }
  const label = registrationStatusTeacherLabel(t, registration.student_facing_status)
  const reason = reasonLine(t, registration, locale)
  return reason && reason.length > label.length ? reason : label
}

const OPENS_A_DIALOG = "dialog" as const

/**
 * The reason line reads as a link, so a column of identical pills doesn't look like there's more
 * to click. A row with nothing to add (registered, in progress) renders the badge alone rather
 * than padding out to match rows that have a reason.
 */
const triggerCss = css`
  display: grid;
  gap: 2px;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;

  /* Only when a reason line is actually rendered -- otherwise this would underline the badge row. */
  &[data-has-reason="true"]:hover > span:last-of-type,
  &[data-has-reason="true"]:focus-visible > span:last-of-type {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
`

const badgeRowCss = css`
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
`

const chevronCss = css`
  flex: none;
  color: var(--link-fg);
`

// The reason is the most useful text in the row, so it is not shrunk below the cell's own size.
const reasonCss = css`
  color: var(--link-fg);
  text-underline-offset: 0.15em;
`

const CHEVRON_RIGHT = "right" as const

/**
 * The registration status, and the only way into its details.
 *
 * A failure's reason goes on a second line: a column of identical "Failed" pills cannot tell a
 * course-wide cause (no course code) from a per-student one (student not found in Sisu).
 */
const CreditRegistrationStatusCell: React.FC<Props> = ({ registration }) => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  const [open, setOpen] = useState(false)
  const label = registrationStatusTeacherLabel(t, registration.student_facing_status)
  const reason = reasonLine(t, registration, i18n.language)

  return (
    <>
      <button
        type="button"
        className={triggerCss}
        data-has-reason={reason ? "true" : "false"}
        onClick={() => setOpen(true)}
        aria-haspopup={OPENS_A_DIALOG}
        aria-label={t("button-text-show-credit-registration-details", { status: label })}
      >
        <span className={badgeRowCss}>
          <RegistrationStatusBadge
            state={registrationStatusState(registration.student_facing_status)}
            size={BADGE_COMPACT}
          >
            {label}
          </RegistrationStatusBadge>
          <ChevronIcon direction={CHEVRON_RIGHT} className={chevronCss} />
        </span>
        {reason && <span className={reasonCss}>{reason}</span>}
      </button>
      {open && (
        <CreditRegistrationDetailsDialog
          registration={registration}
          open={open}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

export default CreditRegistrationStatusCell
