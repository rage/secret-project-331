"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { getEctsEmailPreferences, updateEctsEmailPreferences } from "@/generated/api/sdk.generated"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme } from "@/shared-module/common/styles"

const EctsEmailPreferencesSection: React.FC = () => {
  const { t } = useTranslation()

  const prefsQuery = useQuery({
    queryKey: ["ects-email-preferences"],
    queryFn: () => getEctsEmailPreferences(),
  })

  const updateMutation = useToastMutation<unknown, unknown, boolean>(
    async (optOut) => updateEctsEmailPreferences({ body: { ects_email_opt_out: optOut } }),
    { method: "PUT", notify: true },
    {
      onSuccess: () => {
        prefsQuery.refetch()
      },
    },
  )

  if (!prefsQuery.isSuccess) {
    return null
  }

  const optOut = prefsQuery.data.ects_email_opt_out

  return (
    <div
      className={css`
        margin-top: 1.25rem;
        padding-top: 1.25rem;
        border-top: 1px solid ${baseTheme.colors.gray[100]};
      `}
    >
      <p
        className={css`
          font-size: 0.875rem;
          line-height: 1.5;
          color: ${baseTheme.colors.gray[600]};
          margin: 0 0 0.75rem 0;
        `}
      >
        {t("ects-email-reminder-description")}
      </p>
      <CheckBox
        label={t("ects-email-reminders-enabled-label")}
        checked={!optOut}
        onChange={(e) => updateMutation.mutate(!e.target.checked)}
        disabled={updateMutation.isPending}
      />
    </div>
  )
}

export default EctsEmailPreferencesSection
