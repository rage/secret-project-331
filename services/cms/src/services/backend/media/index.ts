import { MediaItem } from "@wordpress/media-utils"
import { cmsClient } from "../cmsClient"

export const uploadFileFromPage = async (file: File, pageId: string): Promise<MediaItem> => {
  const data = new FormData()
  data.append("file", file, file.name || "unknown")

  const res = await cmsClient.post(`/pages/${pageId}/upload`, data)
  return res.data
}
