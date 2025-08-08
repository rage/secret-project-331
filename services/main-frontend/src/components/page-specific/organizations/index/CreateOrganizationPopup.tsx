import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"

interface CreateOrganizationPopupProps {
  show: boolean
  setShow: React.Dispatch<React.SetStateAction<boolean>>
  name: string
  setName: React.Dispatch<React.SetStateAction<string>>
  visibility: string
  setVisibility: React.Dispatch<React.SetStateAction<string>>
  handleCreate: () => void
  slug: string
  setSlug: React.Dispatch<React.SetStateAction<string>>
}

const CreateOrganizationPopup: React.FC<CreateOrganizationPopupProps> = ({
  show,
  setShow,
  name,
  setName,
  visibility,
  setVisibility,
  handleCreate,
  slug,
  setSlug,
}) => {
  const { t } = useTranslation("main-frontend") as { t: (key: string) => string }

  return (
    <StandardDialog
      open={show}
      onClose={() => setShow(false)}
      title={t("create-organization-title")}
      buttons={[
        {
          children: t("create"),
          onClick: handleCreate,
          // eslint-disable-next-line i18next/no-literal-string
          variant: "primary",
        },
        {
          children: t("button-text-cancel"),
          onClick: () => setShow(false),
          // eslint-disable-next-line i18next/no-literal-string
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

      <div
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
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={css`
              border: 1.6px solid #e4e5e8;
              border-radius: 2px;
              padding: 8px 12px;
              font-size: 14px;
            `}
          />
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
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
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
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={css`
              border: 1.6px solid #e4e5e8;
              border-radius: 2px;
              padding: 8px 12px;
              font-size: 14px;
            `}
          />
        </div>
      </div>
    </StandardDialog>
  )
}

export default CreateOrganizationPopup
