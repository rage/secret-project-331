"use client"

import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import type { CourseCreditRegistration } from "@/generated/api/types.generated"
import { RegistrationStatusBadge } from "@/shared-module/components"

import { registrationStatusLabel, registrationStatusState } from "./creditRegistrationCopy"
import CreditRegistrationDetailsDialog from "./CreditRegistrationDetailsDialog"

interface Props {
  registration: CourseCreditRegistration
}

const triggerCss = css`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: none;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 0 0.25rem;
  cursor: pointer;
  text-align: left;
  color: var(--color-gray-600);

  &:hover {
    border-color: var(--color-gray-300);
    background: var(--color-clear-100);
  }

  &:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: 1px;
  }
`

const chevronCss = css`
  font-size: var(--font-size-1);
  line-height: 1;
`

// oxlint-disable-next-line i18next/no-literal-string
const OPENS_A_DIALOG = "dialog" as const
const DISCLOSURE_CHEVRON = "▾"

/** The registration status, and the only way into its details, so the badge has to read as a control. */
const CreditRegistrationStatusCell: React.FC<Props> = ({ registration }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const label = registrationStatusLabel(t, registration.student_facing_status)

  return (
    <>
      <button
        type="button"
        className={triggerCss}
        onClick={() => setOpen(true)}
        aria-haspopup={OPENS_A_DIALOG}
        aria-label={t("button-text-show-credit-registration-details", { status: label })}
      >
        <RegistrationStatusBadge
          state={registrationStatusState(registration.student_facing_status)}
        >
          {label}
        </RegistrationStatusBadge>
        <span className={chevronCss} aria-hidden="true">
          {DISCLOSURE_CHEVRON}
        </span>
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
