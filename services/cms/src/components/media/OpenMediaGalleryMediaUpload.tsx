import { Button } from "@wordpress/components"
import { useTranslation } from "react-i18next"

// Implements a button that opens a modal into media gallery.
function MediaUploader(): JSX.Element {
  const { t } = useTranslation()
  return <Button>{t("button-text-select-media")}</Button>
}

export const mediaUploadGallery = (): (() => JSX.Element) => MediaUploader

export default MediaUploader
