"use client"

import { css } from "@emotion/css"
import type { TFunction } from "i18next"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import type { CourseCreditRegistration } from "@/generated/api/types.generated"
import { RegistrationStatusBadge } from "@/shared-module/components"
import { ChevronIcon } from "@/shared-module/components/components/primitives/ChevronIcon"

import { BADGE_COMPACT } from "./constants"
import {
  registrationErrorHelp,
  registrationErrorShortLabel,
  registrationStatusState,
  registrationStatusTeacherLabel,
} from "./creditRegistrationCopy"
import CreditRegistrationDetailsDialog from "./CreditRegistrationDetailsDialog"
import { noteCss } from "./styles"

interface Props {
  registration: CourseCreditRegistration
}

/** The badge's padding, its icon and the chevron, none of which text measurement can see. */
export const CREDIT_REGISTRATION_CELL_CHROME_PX = 46

/**
 * The widest line this cell will render, for the off-DOM column measurement that decides how much
 * room the column gets. Without it the column falls back to its minimum and clips the badge.
 */
export const creditRegistrationCellText = (
  t: TFunction,
  registration: CourseCreditRegistration | undefined,
): string => {
  if (!registration) {
    return ""
  }
  const label = registrationStatusTeacherLabel(t, registration.student_facing_status)
  const reason = registrationErrorShortLabel(t, registration.error_code)
  return reason && reason.length > label.length ? reason : label
}

// oxlint-disable-next-line i18next/no-literal-string
const OPENS_A_DIALOG = "dialog" as const

/**
 * The chevron, not a hover underline, is what says the cell opens something: underlined pill text
 * reads as a rendering fault, and on touch there is no hover to reveal it with.
 */
const triggerCss = css`
  display: grid;
  gap: 2px;
  justify-items: start;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;

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
  color: var(--color-gray-400);
`

// oxlint-disable-next-line i18next/no-literal-string -- a direction, not user-facing text
const CHEVRON_RIGHT = "right" as const

/**
 * The registration status, and the only way into its details.
 *
 * A failure's reason goes on a second line: a column of identical "Failed" pills cannot tell a
 * course-wide cause (no course code) from a per-student one (student not found in the registry).
 */
const CreditRegistrationStatusCell: React.FC<Props> = ({ registration }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const label = registrationStatusTeacherLabel(t, registration.student_facing_status)
  const reason = registrationErrorShortLabel(t, registration.error_code)
  const reasonHelp = registrationErrorHelp(t, registration.error_code)

  return (
    <>
      <button
        type="button"
        className={triggerCss}
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
        {reason && (
          <span className={noteCss} title={reasonHelp ?? undefined}>
            {reason}
          </span>
        )}
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
