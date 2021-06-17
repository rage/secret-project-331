import axios from "axios"
import { MediaItem } from "@wordpress/media-utils"

interface UploadFileProps {
  imageData: FormData
  pageId: string
}

export const uploadFile = async ({ imageData, pageId }: UploadFileProps): Promise<MediaItem> => {
  const url = `/api/v0/cms/pages/${pageId}/upload`

  const data = (await axios.post(url, imageData)).data
  return data
}
