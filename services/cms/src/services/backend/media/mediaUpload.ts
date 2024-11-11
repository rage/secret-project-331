import { MediaItem, uploadMedia } from "./uploadMediaToServer"
export interface MediaUploadProps {
  allowedTypes: string[]
  filesList: File[]
  // Below commented probably the future onError function for Gutenberg
  // Blocks seem to want a message as string still.
  //onError: (error: { code: UploadMediaErrorCode; message: string; file: File }) => void
  onError: (message: string) => void
  onFileChange: (files: Partial<MediaItem>[]) => void
}

type MediaUpload = { courseId: string } | { examId: string }

export function mediaUploadBuilder(
  uploadType: MediaUpload,
): (props: MediaUploadProps) => Promise<void> {
  const mediaUpload = async (props: MediaUploadProps): Promise<void> => {
    // 10 MB = 10485760 B
    const maxUploadFileSize = 10485760
    await uploadMedia({ ...props, maxUploadFileSize, uploadType })
  }
  return mediaUpload
}

export default mediaUploadBuilder
