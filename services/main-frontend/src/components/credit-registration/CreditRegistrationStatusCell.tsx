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
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
`

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
        aria-label={t("button-text-show-credit-registration-details", { status: label })}
      >
        <RegistrationStatusBadge
          state={registrationStatusState(registration.student_facing_status)}
        >
          {label}
        </RegistrationStatusBadge>
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
