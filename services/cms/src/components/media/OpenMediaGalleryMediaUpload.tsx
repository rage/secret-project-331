import { Button } from "@wordpress/components"

// Implements a button that opens a modal into media gallery.
function MediaUploader(): JSX.Element {
  return <Button>Select image from media gallery (not implemented)</Button>
}

export const mediaUploadGallery = (): (() => JSX.Element) => MediaUploader

export default MediaUploader
