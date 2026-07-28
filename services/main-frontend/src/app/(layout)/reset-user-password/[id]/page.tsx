"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useTranslation } from "react-i18next"

import ResetPasswordForm from "@/components/forms/ResetUserPasswordForm"
import { getResetPasswordTokenStatus } from "@/generated/api/sdk.generated"
import GenericInfobox from "@/shared-module/common/components/GenericInfobox"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { isBoolean } from "@/shared-module/common/utils/fetching"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"
import { validateGeneratedData } from "@/utils/validateGeneratedData"

const ResetPassword: React.FC = () => {
  const { id: token } = useParams<{ id: string }>()
  const { t } = useTranslation()
  usePageTitle(t("title-reset-password"))

  const isValid = useQuery({
    queryKey: ["reset-password-token-status", token],
    queryFn: async () =>
      validateGeneratedData(
        await getResetPasswordTokenStatus({
          body: {
            token,
          },
        }),
        isBoolean,
      ),
  })

  return (
    <div>
      <QueryResult query={isValid}>
        {(data) =>
          data === true ? (
            <ResetPasswordForm token={token} />
          ) : (
            <GenericInfobox>{t("reset-link-has-expired")}</GenericInfobox>
          )
        }
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(ResetPassword)
