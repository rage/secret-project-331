"use client"

import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import type { CourseCreditRegistration } from "@/generated/api/types.generated"
import { RegistrationStatusBadge } from "@/shared-module/components"

import { registrationStatusLabel, registrationStatusState } from "./creditRegistrationCopy"
import CreditRegistrationDetailsDialog from "./CreditRegistrationDetailsDialog"
import { statusTriggerCss } from "./styles"

interface Props {
  registration: CourseCreditRegistration
}

// oxlint-disable-next-line i18next/no-literal-string
const OPENS_A_DIALOG = "dialog" as const

/** The registration status, and the only way into its details, so the badge has to read as a control. */
const CreditRegistrationStatusCell: React.FC<Props> = ({ registration }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const label = registrationStatusLabel(t, registration.student_facing_status)

  return (
    <>
      <button
        type="button"
        className={statusTriggerCss}
        onClick={() => setOpen(true)}
        aria-haspopup={OPENS_A_DIALOG}
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
