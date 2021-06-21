import { MediaItem } from "@wordpress/media-utils"
import { uploadMedia } from "./uploadMediaToServer"
export interface MediaUploadProps {
  allowedTypes: string[]
  filesList: ArrayLike<File>
  // Below commented probably the future onError function. ?
  //onError: (error: { code: UploadMediaErrorCode; message: string; file: File }) => void
  onError: (message: string) => void
  onFileChange: (files: MediaItem[]) => void
}

export function mediaUploadBuilder(pageId: string): (props: MediaUploadProps) => Promise<void> {
  const mediaUpload = async (props: MediaUploadProps): Promise<void> => {
    // 5 MB = 5242880 B
    const maxUploadFileSize = 5242880
    await uploadMedia({ ...props, maxUploadFileSize, pageId })
  }
  return mediaUpload
}

export default mediaUploadBuilder
