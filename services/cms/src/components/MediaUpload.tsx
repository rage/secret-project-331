import { Button } from "@wordpress/components"
import { MediaUpload, MediaUploadCheck } from "@wordpress/block-editor"

const ALLOWED_MEDIA_TYPES = ["image"]

function MyMediaUploader(): JSX.Element {
  return (
    <MediaUploadCheck>
      <MediaUpload
        onSelect={(media) => console.log("selected " + media.length)}
        allowedTypes={ALLOWED_MEDIA_TYPES}
        render={({ open }) => <Button onClick={open}>Open Media Library</Button>}
      />
    </MediaUploadCheck>
  )
}

export default MyMediaUploader
