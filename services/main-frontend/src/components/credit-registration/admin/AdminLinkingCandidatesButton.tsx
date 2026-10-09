"use client"

import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import type { ButtonVariant } from "@/shared-module/components"
import { Button } from "@/shared-module/components"

import { CREDIT_REGISTRATION_NS } from "../constants"
import AdminLinkingCandidatesDialog from "./AdminLinkingCandidatesDialog"

interface Props {
  registrationId: string
  variant?: ButtonVariant
}

/** Opens the linking candidates dialog, which lists the enrolment list from Sisu only once opened. */
const AdminLinkingCandidatesButton: React.FC<Props> = ({
  registrationId,
  variant = "tertiary",
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant={variant} size="medium" onClick={() => setOpen(true)}>
        {t("button-text-guess-from-enrolment-list")}
      </Button>
      <AdminLinkingCandidatesDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        registrationId={registrationId}
      />
    </>
  )
}

export default AdminLinkingCandidatesButton
