import React, { useState } from "react"

import { removeOrganizationImage, setOrganizationImage } from "../services/backend/organizations"
import { Organization } from "../shared-module/bindings"
import Button from "../shared-module/components/Button"

import UploadImageForm from "./forms/UploadImageForm"

export interface OrganizationImageControlsProps {
  organization: Organization
  onOrganizationUpdated: () => void
}

const OrganizationImageWidget: React.FC<OrganizationImageControlsProps> = ({
  organization,
  onOrganizationUpdated,
}) => {
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
            src={organization.organization_image_url}
            alt="What to display on the organization."
          />
          <Button size="medium" variant="secondary" onClick={handleRemove} disabled={!allowRemove}>
            Remove image
          </Button>
        </>
      ) : (
        <div>No organization image.</div>
      )}
      <UploadImageForm onSubmit={handleSubmit} />
    </div>
  )
}

export default OrganizationImageWidget
