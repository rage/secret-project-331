import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  removeOrganizationImage,
  setOrganizationImage,
} from "../../../../services/backend/organizations"
import { Organization } from "../../../../shared-module/bindings"
import Button from "../../../../shared-module/components/Button"
import UploadImageForm from "../../../forms/UploadImageForm"

export interface OrganizationImageControlsProps {
  organization: Organization
  onOrganizationUpdated: () => void
}

const OrganizationImageWidget: React.FC<
  React.PropsWithChildren<OrganizationImageControlsProps>
> = ({ organization, onOrganizationUpdated }) => {
  const { t } = useTranslation()
  const [allowRemove, setAllowRemove] = useState(true)
  const [error, setError] = useState<unknown>()

  const handleSubmit = async (imageFile: File) => {
    try {
      await setOrganizationImage(organization.id, imageFile)
      onOrganizationUpdated()
      setError(undefined)
    } catch (e) {
      setError(e)
    }
  }

  const handleRemove = async () => {
    setAllowRemove(false)
    try {
      await removeOrganizationImage(organization.id)
      onOrganizationUpdated()
      setError(undefined)
    } catch (e) {
      setError(e)
    } finally {
      setAllowRemove(true)
    }
  }

  return (
    <div>
      {error && <pre>{JSON.stringify(`${error}`, undefined, 2)}</pre>}
      {organization.organization_image_url ? (
        <>
          <img
            className={css`
              max-width: 20rem;
              max-height: 20rem;
            `}
            src={organization.organization_image_url}
            alt={t("image-alt-what-to-display-on-organization")}
          />
          <Button size="medium" variant="secondary" onClick={handleRemove} disabled={!allowRemove}>
            {t("button-text-remove")}
          </Button>
        </>
      ) : (
        <div>{t("no-organization-image")}</div>
      )}
      <UploadImageForm onSubmit={handleSubmit} />
    </div>
  )
}

export default OrganizationImageWidget
