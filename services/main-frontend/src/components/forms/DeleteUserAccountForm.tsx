import { useQueryClient } from "@tanstack/react-query"
import i18n from "i18next"
import { useRouter } from "next/router"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import VerifyOneTimeCodeForm from "./VerifyOneTimeCodeFrom"
import VerifyPasswordForm from "./VerifyPasswordForm"

import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { deleteUserAccount, sendEmailCode } from "@/shared-module/common/services/backend/auth"

interface DeleteUserAccountProps {
  email: string
}

type Step = "password" | "verifyCode"

const DeleteUserAccountForm: React.FC<DeleteUserAccountProps> = ({ email }) => {
  const { t } = useTranslation()
  const loginStateContext = useContext(LoginStateContext)
  const queryClient = useQueryClient()
  const router = useRouter()

  // eslint-disable-next-line i18next/no-literal-string
  const [step, setStep] = useState<Step>("password")
  const [password, setPassword] = useState("")

  const [credentialsError, setCredentialsError] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [openDialog, setOpenDialog] = useState(false)

  const sendEmailCodeMutation = useToastMutation(
    async (password: string) => {
      const result = await sendEmailCode(email, password, i18n.language)
      setError(null)
      setCredentialsError(!result)
      return result
    },
    { notify: false },
    {
      onSuccess: (result) => {
        if (result) {
          // eslint-disable-next-line i18next/no-literal-string
          setStep("verifyCode")
        }
      },
    },
  )

  const deleteAccountMutation = useToastMutation(
    async (code: string) => {
      const result = await deleteUserAccount(code)
      setError(null)
      setCredentialsError(!result)
      return result
    },
    { notify: false },
    {
      onSuccess: (result) => {
        if (result) {
          queryClient.removeQueries()
          loginStateContext.refresh()
          // eslint-disable-next-line i18next/no-literal-string
          router.push("/login")
        }
      },
    },
  )

  return (
    <>
      <Button variant="secondary" size="small" onClick={() => setOpenDialog(true)}>
        {t("title-delete-account")}
      </Button>

      <StandardDialog
        open={openDialog}
        title={t("title-delete-account")}
        showCloseButton
        // eslint-disable-next-line i18next/no-literal-string
        aria-modal="true"
        onClose={() => setOpenDialog(false)}
      >
        {error && <ErrorBanner error={error} />}

        {step === "password" && (
          <VerifyPasswordForm
            onSubmit={(password) => {
              setPassword(password)
              sendEmailCodeMutation.mutateAsync(password)
            }}
            isPending={sendEmailCodeMutation.isPending}
            credentialsError={credentialsError}
          />
        )}

        {step === "verifyCode" && (
          <VerifyOneTimeCodeForm
            onSubmit={(code) => deleteAccountMutation.mutateAsync(code)}
            onResend={() => sendEmailCodeMutation.mutateAsync(password)}
            credentialsError={credentialsError}
          />
        )}
      </StandardDialog>
    </>
  )
}

export default DeleteUserAccountForm
