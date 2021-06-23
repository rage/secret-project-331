import { MediaItem } from "@wordpress/media-utils"
import { cmsClient } from "../cmsClient"

interface UploadFileProps {
  uploadData: FormData
  pageId: string
}

export const uploadFileFromPage = async ({
  uploadData,
  pageId,
}: UploadFileProps): Promise<MediaItem> => {
  const url = `/pages/${pageId}/upload`

  const res = await cmsClient.post(url, uploadData)
  return res.data
}
