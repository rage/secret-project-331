import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { deleteUserAccount } from "@/shared-module/common/services/backend/auth"

interface DeleteUserAccountProps {
  email: string
}

const DeleteUserAccountForm: React.FC<React.PropsWithChildren<DeleteUserAccountProps>> = ({
  email,
}) => {
  const {
    handleSubmit,
    formState: { isValid },
  } = useForm<DeleteUserAccountProps>({
    // eslint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: { email },
  })
  const { t } = useTranslation()
  const [password, setPassword] = useState("")
  const [credentialsError, setCredentialsError] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [openDialog, setOpenDialog] = useState(false)

  const deleteAccountMutation = useToastMutation(
    async () => {
      const success = await deleteUserAccount(email, password)
      setError(null)
      setCredentialsError(!success)
      return success
    },
    { notify: false },
  )

  const onSubmit = async () => {
    try {
      const success = await deleteAccountMutation.mutateAsync()
      if (success) {
        // Jos haluat refetchata queryjä -> käytä queryClient.invalidateQueries()
        // Tällä hetkellä ei tarvita refresh-metodia
      }
    } catch (e) {
      if (e instanceof Error) {
        console.error("failed to delete account: ", e)
        setError(e)
      } else {
        throw e
      }
    }
  }

  return (
    <>
      <Button variant={"secondary"} size={"small"} onClick={() => setOpenDialog(true)}>
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
            onClick: handleSubmit(onSubmit),
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
        <br />

        {error && <ErrorBanner error={error} />}
        {credentialsError && <ErrorBanner error={new Error("Invalid credentials")} />}
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleSubmit(onSubmit)()
          }}
        >
          <TextField
            type="password"
            label={t("label-password")}
            onChange={(event) => {
              setPassword(event.target.value)
              setCredentialsError(false)
            }}
            required
          />
        </form>
      </StandardDialog>
    </>
  )
}

export default DeleteUserAccountForm
