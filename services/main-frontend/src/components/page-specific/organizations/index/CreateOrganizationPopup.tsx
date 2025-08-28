import { css } from "@emotion/css"
import React, { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"

type CreateOrganizationForm = {
  name: string
  visibility: "public" | "private"
  slug: string
}

interface CreateOrganizationPopupProps {
  show: boolean
  onClose: () => void
  onCreate: (data: CreateOrganizationForm) => void
}

const CreateOrganizationPopup: React.FC<CreateOrganizationPopupProps> = ({
  show,
  onClose,
  onCreate,
}) => {
  const { t } = useTranslation("main-frontend")
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateOrganizationForm>({
    defaultValues: {
      name: "",
      // eslint-disable-next-line i18next/no-literal-string
      visibility: "public", // internal value, not a UI label
      slug: "",
    },
  })

  // When popup is closed, reset the form for next open
  useEffect(() => {
    if (!show) {
      reset()
    }
  }, [show, reset])

  const submitForm = handleSubmit((data) => {
    onCreate(data)
    onClose()
    reset()
  })

  return (
    <StandardDialog
      open={show}
      onClose={onClose}
      title={t("create-organization-title")}
      buttons={[
        {
          children: t("create"),
          onClick: submitForm,
          variant: "primary",
        },
        {
          children: t("button-text-cancel"),
          onClick: onClose,
          variant: "secondary",
        },
      ]}
    >
      <p
        className={css`
          font-size: 16px;
          margin-bottom: 32px;
        `}
      >
        {t("create-organization-description")}
      </p>

      <form onSubmit={submitForm}>
        <TextField
          {...register("name", { required: true })}
          label={t("label-organization-name")}
          error={errors.name ? t("validation-required") : undefined}
        />

        <SelectField
          {...register("visibility")}
          id="org-visibility"
          label={t("label-visibility")}
          options={[
            // eslint-disable-next-line i18next/no-literal-string
            { value: "public", label: t("label-visible") }, // uses internal value
            // eslint-disable-next-line i18next/no-literal-string
            { value: "private", label: t("label-hidden") }, // uses internal value
          ]}
        />

        <TextField
          {...register("slug", { required: true })}
          label={t("label-slug")}
          error={errors.slug ? t("validation-required") : undefined}
        />
      </form>
    </StandardDialog>
  )
}

export default CreateOrganizationPopup
