import { MediaItem, UploadMediaErrorCode } from "@wordpress/media-utils"
import { uploadMedia } from "./uploadMediaToServer"
export interface MediaUploadProps {
  allowedTypes: string[]
  filesList: ArrayLike<File>
  onError: (error: { code: UploadMediaErrorCode; message: string; file: File }) => void
  // onError: (message: string) => void
  onFileChange: (files: MediaItem[]) => void
}

export function mediaUploadBuilder(pageId: string): (props: MediaUploadProps) => Promise<void> {
  const mediaUpload = async (props: MediaUploadProps): Promise<void> => {
    console.log("Media upload", props)
    const maxUploadFileSize = 1000000
    await uploadMedia({ ...props, maxUploadFileSize, pageId })
  }
  return mediaUpload
}

export default mediaUploadBuilder
