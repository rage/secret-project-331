import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/router"
import React, { useContext, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { deleteUserAccount } from "@/shared-module/common/services/backend/auth"

interface DeleteUserAccountProps {
  email: string
}

const DeleteUserAccountForm: React.FC<React.PropsWithChildren<DeleteUserAccountProps>> = ({
  email,
}) => {
  const {
    formState: { isValid },
  } = useForm<DeleteUserAccountProps>({
    // eslint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: { email },
  })
  const { t } = useTranslation()
  const loginStateContext = useContext(LoginStateContext)

  const [password, setPassword] = useState("")
  const [credentialsError, setCredentialsError] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [openDialog, setOpenDialog] = useState(false)
  const queryClient = useQueryClient()
  const router = useRouter()

  const deleteAccountMutation = useToastMutation(
    async () => {
      const success = await deleteUserAccount(email, password)
      setError(null)
      setCredentialsError(!success)
      return success
    },
    {
      method: "POST",
      notify: true,
    },
    {
      onSuccess: () => {
        setOpenDialog(false)
        queryClient.removeQueries()
        loginStateContext.refresh()
        // eslint-disable-next-line i18next/no-literal-string
        router.push("/login?return_to=%2F")
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
        buttons={[
          {
            type: "submit",
            disabled: !isValid || deleteAccountMutation.isPending,
            // eslint-disable-next-line i18next/no-literal-string
            className: "primary-button",
            variant: "primary",
            children: t("confirm"),
            onClick: () => deleteAccountMutation.mutateAsync(),
          },
          {
            type: "submit",
            disabled: !isValid || deleteAccountMutation.isPending,
            // eslint-disable-next-line i18next/no-literal-string
            className: "primary-button",
            variant: "primary",
            children: t("button-text-cancel"),
            onClick: () => setOpenDialog(false),
          },
        ]}
      >
        <p>{t("delete-account-info")}</p>

        {error && <ErrorBanner error={error} />}
        {credentialsError && <ErrorBanner error={new Error("Invalid credentials")} />}

        <TextField
          type="password"
          label={t("label-password")}
          onChange={(event) => {
            setPassword(event.target.value)
            setCredentialsError(false)
          }}
          required
        />
      </StandardDialog>
    </>
  )
}

export default DeleteUserAccountForm
