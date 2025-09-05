import { css } from "@emotion/css"
import { BlockIcon, MediaPlaceholder } from "@wordpress/block-editor"
import { Placeholder } from "@wordpress/components"
import { cover as icon } from "@wordpress/icons"
import React from "react"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"

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

  return (
    <div key={imageKey}>
      {currentImage ? (
        <Placeholder
          className={placeHolderFixHeightStyles}
          icon={<BlockIcon icon={icon} />}
          label={label}
        >
          <Button variant="tertiary" size="medium" onClick={onImageRemove}>
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
          onSelect={(media) => {
            onImageSelect(media.url)
          }}
          accept={ALLOWED_MIMETYPES_FOR_UPLOAD.join(",")}
          allowedTypes={ALLOWED_MIMETYPES_FOR_UPLOAD}
          onError={(error) => {
            console.error({ error })
          }}
          className={placeHolderFixHeightStyles}
          onHTMLDrop={undefined}
        />
      )}
    </div>
  )
}

export default BackgroundImageSection
