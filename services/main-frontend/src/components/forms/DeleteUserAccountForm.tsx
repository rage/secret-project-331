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

interface DeleteUserAccountProps {
  email: string
}

type Step = "password" | "verifyCode"

const DeleteUserAccountForm: React.FC<DeleteUserAccountProps> = ({ email }) => {
  const { t } = useTranslation()
  const loginStateContext = useContext(LoginStateContext)
  const queryClient = useQueryClient()
  const router = useRouter()

  // oxlint-disable-next-line i18next/no-literal-string
  const [step, setStep] = useState<Step>("password")
  const [password, setPassword] = useState("")

  const [credentialsError, setCredentialsError] = useState(false)
  const [openDialog, setOpenDialog] = useState(false)

  const sendEmailCodeMutation = useToastMutation(
    async (passwordInput: string) => {
      const result = await postAuthSendEmailCode({
        body: { email, password: passwordInput, language: i18n.language },
      })
      setCredentialsError(!result)
      return result
    },
    { notify: false },
    {
      onSuccess: (result) => {
        if (result) {
          // oxlint-disable-next-line i18next/no-literal-string
          setStep("verifyCode")
        }
      },
      onError: () => {
        setCredentialsError(false)
      },
    },
  )

  const deleteAccountMutation = useToastMutation(
    async (code: string) => {
      const result = await postAuthDeleteUserAccount({
        body: { code },
      })
      setCredentialsError(!result)
      return result
    },
    { notify: false },
    {
      onSuccess: (result) => {
        if (result) {
          queryClient.removeQueries()
          loginStateContext.refresh()

          router.push(accountDeletedRoute())
        }
      },
      onError: () => {
        setCredentialsError(false)
      },
    },
  )

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

        {step === "password" && (
          <VerifyPasswordForm
            onSubmit={(passwordValue) => {
              setPassword(passwordValue)
              sendEmailCodeMutation.mutateAsync(passwordValue)
            }}
            isPending={sendEmailCodeMutation.isPending}
            credentialsError={credentialsError}
          />
        )}

        {step === "verifyCode" && (
          <OneTimeCodeForm
            containerClassName={css`
              padding: 0;
            `}
            message={t("insert-single-use-code-account-deletion")}
            onSubmit={async (code) => {
              await deleteAccountMutation.mutateAsync(code)
            }}
            submitLabel={t("button-text-verify")}
            error={credentialsError ? t("incorrect-code") : null}
            isSubmitting={deleteAccountMutation.isPending}
            resend={{
              helperText: t("delete-account-did-not-receive-email"),
              label: t("resend"),
              onResend: () => sendEmailCodeMutation.mutateAsync(password),
            }}
          />
        )}
      </StandardDialog>
    </>
  )
}

export default DeleteUserAccountForm
