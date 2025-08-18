import { css } from "@emotion/css"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

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
  React.useEffect(() => {
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

      <form
        onSubmit={submitForm}
        className={css`
          display: flex;
          flex-direction: column;
          gap: 24px;
          margin-bottom: 32px;
        `}
      >
        {/* Organization Name */}
        <div
          className={css`
            flex: 1;
            display: flex;
            flex-direction: column;
          `}
        >
          <label htmlFor="org-name">{t("label-organization-name")}</label>
          <input
            id="org-name"
            type="text"
            {...register("name", { required: true })}
            className={css`
              border: 1.6px solid #e4e5e8;
              border-radius: 2px;
              padding: 8px 12px;
              font-size: 14px;
            `}
          />
          {errors.name && (
            <span
              className={css`
                color: red;
                font-size: 12px;
              `}
            >
              {t("validation-required")}
            </span>
          )}
        </div>

        {/* Visibility */}
        <div
          className={css`
            flex: 1;
            display: flex;
            flex-direction: column;
          `}
        >
          <label htmlFor="org-visibility">{t("label-visibility")}</label>
          <select
            id="org-visibility"
            {...register("visibility")}
            className={css`
              border: 1.6px solid #e4e5e8;
              border-radius: 2px;
              padding: 8px 12px;
              font-size: 14px;
              background-color: white;
            `}
          >
            <option value="public">{t("label-visible")}</option>
            <option value="private">{t("label-hidden")}</option>
          </select>
        </div>
        {/* Slug */}
        <div
          className={css`
            flex: 1;
            display: flex;
            flex-direction: column;
          `}
        >
          <label htmlFor="org-slug">{t("label-slug")}</label>
          <input
            id="org-slug"
            type="text"
            {...register("slug", { required: true })}
            className={css`
              border: 1.6px solid #e4e5e8;
              border-radius: 2px;
              padding: 8px 12px;
              font-size: 14px;
            `}
          />
          {errors.slug && (
            <span
              className={css`
                color: red;
                font-size: 12px;
              `}
            >
              {t("validation-required")}
            </span>
          )}
        </div>
      </form>
    </StandardDialog>
  )
}

export default CreateOrganizationPopup
