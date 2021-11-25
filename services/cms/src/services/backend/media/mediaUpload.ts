import { MediaItem } from "@wordpress/media-utils"

import { uploadMedia } from "./uploadMediaToServer"
export interface MediaUploadProps {
  allowedTypes: string[]
  filesList: ArrayLike<File>
  // Below commented probably the future onError function for Gutenberg
  // Blocks seem to want a message as string still.
  //onError: (error: { code: UploadMediaErrorCode; message: string; file: File }) => void
  onError: (message: string) => void
  onFileChange: (files: Partial<MediaItem>[]) => void
}

export function mediaUploadBuilder(
  organizationId: string,
): (props: MediaUploadProps) => Promise<void> {
  const mediaUpload = async (props: MediaUploadProps): Promise<void> => {
    // 10 MB = 10485760 B
    const maxUploadFileSize = 10485760
    await uploadMedia({ ...props, maxUploadFileSize, organizationId })
  }
  return mediaUpload
}

export default mediaUploadBuilder
