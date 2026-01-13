"use client"
import { css } from "@emotion/css"
import { BlockIcon, MediaPlaceholder } from "@wordpress/block-editor"
import { Placeholder } from "@wordpress/components"
import { cover as icon } from "@wordpress/icons"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"

interface MediaObject {
  id: number
  url: string
  [key: string]: unknown
}

const placeHolderFixHeightStyles = css`
  min-height: unset !important;
  margin-bottom: 1rem !important;
`

const ALLOWED_MIMETYPES_FOR_UPLOAD = ["image/svg+xml"]

interface BackgroundImageSectionProps {
  imageKey: string
  currentImage: string | undefined
  label: string
  description?: string
  onImageSelect: (url: string) => void
  onImageRemove: () => void
}

/**
 * Background image upload section for a specific screen size.
 */
const BackgroundImageSection: React.FC<BackgroundImageSectionProps> = ({
  imageKey,
  currentImage,
  label,
  description,
  onImageSelect,
  onImageRemove,
}) => {
  const { t } = useTranslation()
  const [error, setError] = useState<string | undefined>(undefined)

  const handleImageSelect = (media: MediaObject) => {
    setError(undefined) // Clear any previous errors
    onImageSelect(media.url)
  }

  const handleImageRemove = () => {
    setError(undefined) // Clear any previous errors
    onImageRemove()
  }

  const handleError = (error: unknown) => {
    let errorMessage = t("upload-error-unknown")

    if (error instanceof Error) {
      errorMessage = error.message
    } else if (typeof error === "string") {
      errorMessage = error
    } else if (error && typeof error === "object" && "message" in error) {
      errorMessage = String(error.message)
    }

    setError(errorMessage)
  }

  return (
    <div key={imageKey}>
      {error && <ErrorBanner error={error} />}
      {currentImage ? (
        <Placeholder
          className={placeHolderFixHeightStyles}
          icon={<BlockIcon icon={icon} />}
          label={label}
        >
          <Button variant="tertiary" size="medium" onClick={handleImageRemove}>
            {t("remove")}
          </Button>
        </Placeholder>
      ) : (
        <MediaPlaceholder
          icon={<BlockIcon icon={icon} />}
          labels={{
            title: label,
            instructions: description || t("upload-or-drag-and-drop-onto-this-block"),
          }}
          onSelect={handleImageSelect}
          accept={ALLOWED_MIMETYPES_FOR_UPLOAD.join(",")}
          allowedTypes={ALLOWED_MIMETYPES_FOR_UPLOAD}
          onError={handleError}
          className={placeHolderFixHeightStyles}
          onHTMLDrop={undefined}
        />
      )}
    </div>
  )
}

export default BackgroundImageSection
