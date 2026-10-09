"use client"

import { useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  getAccountLinkingStatsQueryKey,
  getCreditRegistrationAttentionItemsQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import { adminRequestEnrolmentListFetch } from "@/generated/api/sdk.generated"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { Button } from "@/shared-module/components"

import { BUTTON_TERTIARY, CREDIT_REGISTRATION_NS } from "../constants"

/** Brings one course code's enrolment list forward to its next fetch slot, after a confirmation. */
const FetchEnrolmentListNowButton: React.FC<{ courseCode: string }> = ({ courseCode }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const queryClient = useQueryClient()
  const { confirm } = useDialog()
  const mutation = useToastMutation(
    () => adminRequestEnrolmentListFetch({ body: { course_code: courseCode } }),
    { notify: true, method: "POST" },
    {
      onSuccess: () =>
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: getAccountLinkingStatsQueryKey() }),
          queryClient.invalidateQueries({
            queryKey: getCreditRegistrationAttentionItemsQueryKey(),
          }),
        ]),
    },
  )
  return (
    <Button
      variant={BUTTON_TERTIARY}
      size="medium"
      disabled={mutation.isPending}
      aria-label={t("credit-registration-admin-fetch-enrolment-list-of", { code: courseCode })}
      onClick={async () => {
        const confirmed = await confirm(
          t("credit-registration-admin-fetch-now-confirm", { code: courseCode }),
          undefined,
          { yesButtonLabel: t("button-text-fetch-enrolment-list-now") },
        )
        if (confirmed) {
          mutation.mutate()
        }
      }}
    >
      {t("button-text-fetch-enrolment-list-now")}
    </Button>
  )
}

export default FetchEnrolmentListNowButton
