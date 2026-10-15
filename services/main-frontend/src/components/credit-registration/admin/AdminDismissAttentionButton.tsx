"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { adminDismissCreditRegistrationAttention } from "@/generated/api/sdk.generated"

import { CREDIT_REGISTRATION_NS } from "../constants"
import { useInvalidateAttentionItems } from "./adminCreditRegistrationHooks"
import { useReasonConfirmAction } from "./useReasonConfirmAction"

/**
 * Takes a registration off Needs attention with a reason. Not the pipeline's "clear attention":
 * the row comes back if a reason the dismissal did not cover fires.
 */
const AdminDismissAttentionButton: React.FC<{ registrationId: string }> = ({ registrationId }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const invalidateAttentionItems = useInvalidateAttentionItems()
  const { button, dialog } = useReasonConfirmAction({
    mutationFn: ({ reason }) =>
      adminDismissCreditRegistrationAttention({
        path: { credit_registration_id: registrationId },
        body: { reason },
      }),
    invalidate: () => void invalidateAttentionItems(),
    buttonLabel: t("credit-registration-admin-dismiss"),
    dialogTitle: t("credit-registration-admin-dismiss-title"),
    dialogMessage: t("credit-registration-admin-dismiss-description"),
  })
  return (
    <>
      {button}
      {dialog}
    </>
  )
}

export default AdminDismissAttentionButton
