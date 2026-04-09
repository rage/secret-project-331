"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useTranslation } from "react-i18next"

import ResetPasswordForm from "@/components/forms/ResetUserPasswordForm"
import { getResetPasswordTokenStatus } from "@/generated/api/sdk.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import GenericInfobox from "@/shared-module/common/components/GenericInfobox"
import Spinner from "@/shared-module/common/components/Spinner"
import { isBoolean } from "@/shared-module/common/utils/fetching"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { validateGeneratedData } from "@/utils/validateGeneratedData"

const ResetPassword: React.FC = () => {
  const { id: token } = useParams<{ id: string }>()
  const { t } = useTranslation()

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
      {isValid.isError && <ErrorBanner variant="readOnly" error={isValid.error} />}
      {isValid.isLoading && <Spinner variant="medium" />}
      {isValid.isSuccess && (
        <>
          {isValid.data === true ? (
            <ResetPasswordForm token={token} />
          ) : (
            <GenericInfobox>{t("reset-link-has-expired")}</GenericInfobox>
          )}
        </>
      )}
    </div>
  )
}

export default withErrorBoundary(ResetPassword)
