import { MediaItem } from "@wordpress/media-utils"

import { cmsClient } from "../cmsClient"

export const uploadFileFromPage = async (file: File, courseId: string): Promise<MediaItem> => {
  const data = new FormData()
  data.append("file", file, file.name || "unknown")

  const res = await cmsClient.post(`/courses/${courseId}/upload`, data)
  return res.data
}
