/* eslint-disable i18next/no-literal-string */
import { MediaItem } from "@wordpress/media-utils"

import { cmsClient } from "../cmsClient"

export const uploadFileFromPage = async (
  file: File,
  organizationId: string,
): Promise<MediaItem> => {
  const data = new FormData()
  data.append("file", file, file.name || "unknown")

  const res = await cmsClient.post(`/organizations/${organizationId}/upload`, data)
  return res.data
}
