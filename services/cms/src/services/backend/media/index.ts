import axios from "axios"
import { MediaItem } from "@wordpress/media-utils"

interface UploadFileProps {
  uploadData: FormData
  pageId: string
}

export const uploadFile = async ({ uploadData, pageId }: UploadFileProps): Promise<MediaItem> => {
  const url = `/api/v0/cms/pages/${pageId}/upload`

  const data = (await axios.post(url, uploadData)).data
  return data
}
