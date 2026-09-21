"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import i18n from "i18next"
import { useRouter } from "next/navigation"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import {
  postAuthDeleteUserAccount,
  postAuthSendEmailCode,
} from "@/shared-module/common/generated/auth-api/sdk.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { accountDeletedRoute } from "@/shared-module/common/utils/routes"

import OneTimeCodeForm from "./OneTimeCodeForm"
import "@/shared-module/common/init/registerAuthApiClients"

import VerifyPasswordForm from "./VerifyPasswordForm"

const PASSWORD_STEP = "password"
const VERIFY_CODE_STEP = "verifyCode"

type Step = typeof PASSWORD_STEP | typeof VERIFY_CODE_STEP

const DeleteUserAccountForm: React.FC = () => {
  const { t } = useTranslation()
  const loginStateContext = useContext(LoginStateContext)
  const queryClient = useQueryClient()
  const router = useRouter()

  const [step, setStep] = useState<Step>(PASSWORD_STEP)
  const [password, setPassword] = useState("")

  const [incorrectPassword, setIncorrectPassword] = useState(false)
  const [codeErrorMessage, setCodeErrorMessage] = useState<string | null>(null)
  const [openDialog, setOpenDialog] = useState(false)

  const sendEmailCodeMutation = useToastMutation(
    async (passwordInput: string) =>
      await postAuthSendEmailCode({
        body: { password: passwordInput, language: i18n.language },
      }),
    { notify: false },
    {
      onSuccess: (result) => {
        setIncorrectPassword(result.type === "incorrect_password")
        switch (result.type) {
          case "queued":
            setCodeErrorMessage(null)
            setStep(VERIFY_CODE_STEP)
            break
          // The outstanding code still works, so the user can go on and type it.
          case "recently_sent":
            setCodeErrorMessage(
              t("delete-account-code-recently-sent", { seconds: result.retry_after_seconds }),
            )
            setStep(VERIFY_CODE_STEP)
            break
          case "incorrect_password":
            break
        }
      },
      onError: () => {
        setIncorrectPassword(false)
        setCodeErrorMessage(null)
      },
    },
  )

  const deleteAccountMutation = useToastMutation(
    async (code: string) => await postAuthDeleteUserAccount({ body: { code } }),
    { notify: false },
    {
      onSuccess: (result) => {
        switch (result.type) {
          case "deleted":
            setCodeErrorMessage(null)
            queryClient.removeQueries()
            loginStateContext.refresh()
            router.push(accountDeletedRoute())
            break
          case "invalid_code":
            setCodeErrorMessage(t("incorrect-code"))
            break
          case "expired_code":
            setCodeErrorMessage(t("delete-account-code-expired"))
            break
          case "too_many_attempts":
            setCodeErrorMessage(t("delete-account-too-many-attempts"))
            break
          case "upstream_unavailable":
            setCodeErrorMessage(t("delete-account-upstream-unavailable"))
            break
          case "upstream_rejected":
            setCodeErrorMessage(
              t("delete-account-upstream-rejected", { reference: result.reference }),
            )
            break
        }
      },
      onError: () => {
        setCodeErrorMessage(null)
      },
    },
  )

  const requestDeletionCode = async (passwordInput: string) => {
    try {
      await sendEmailCodeMutation.mutateAsync(passwordInput)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <>
      <Button
        data-testid="delete-account-button"
        variant="secondary"
        size="small"
        onClick={() => setOpenDialog(true)}
      >
        {t("title-delete-account")}
      </Button>

      <StandardDialog
        open={openDialog}
        title={t("title-delete-account")}
        showCloseButton
        // oxlint-disable-next-line i18next/no-literal-string
        aria-modal="true"
        onClose={() => setOpenDialog(false)}
      >
        {(sendEmailCodeMutation.isError || deleteAccountMutation.isError) && (
          <ErrorBanner error={sendEmailCodeMutation.error || deleteAccountMutation.error} />
        )}

        {step === PASSWORD_STEP && (
          <VerifyPasswordForm
            onSubmit={async (passwordValue) => {
              setPassword(passwordValue)
              await requestDeletionCode(passwordValue)
            }}
            isPending={sendEmailCodeMutation.isPending}
            credentialsError={incorrectPassword}
          />
        )}

        {step === VERIFY_CODE_STEP && (
          <OneTimeCodeForm
            containerClassName={css`
              padding: 0;
            `}
            message={t("insert-single-use-code-account-deletion")}
            onSubmit={async (code) => {
              await deleteAccountMutation.mutateAsync(code)
            }}
            submitLabel={t("button-text-verify")}
            error={codeErrorMessage}
            isSubmitting={deleteAccountMutation.isPending}
            resend={{
              helperText: t("delete-account-did-not-receive-email"),
              label: t("resend"),
              onResend: async () => await requestDeletionCode(password),
            }}
          />
        )}
      </StandardDialog>
    </>
  )
}

export default DeleteUserAccountForm
