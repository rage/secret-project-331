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
    console.info("[MediaUpload] Starting media upload with props:", {
      allowedTypes: props.allowedTypes,
      filesCount: props.filesList.length,
      uploadType,
    })

    try {
      await uploadMedia({ ...props, uploadType })
      console.info("[MediaUpload] Upload completed successfully")
    } catch (error) {
      console.error("[MediaUpload] Upload failed:", error)
      throw error
    }
  }
  return mediaUpload
}

export default mediaUploadBuilder
