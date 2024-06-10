import { isBoolean } from "lodash"

import { mainFrontendClient } from "../mainFrontendClient"

import { PageAudioFile } from "@/shared-module/common/bindings"
import { isPageAudioFile } from "@/shared-module/common/bindings.guard"
import { validateResponse } from "@/shared-module/common/utils/fetching"
import { validateFile } from "@/shared-module/common/utils/files"

export const postPageAudioFile = async (pageId: string, file: File): Promise<boolean> => {
  // eslint-disable-next-line i18next/no-literal-string
  validateFile(file, ["audio"])
  const data = new FormData()
  // eslint-disable-next-line i18next/no-literal-string
  data.append("file", file, file.name || "unknown")
  const response = await mainFrontendClient.post(`/page_audio/${pageId}`, data, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  })
  return validateResponse(response, isBoolean)
}

export const removePageAudioFile = async (fileId: string): Promise<void> => {
  await mainFrontendClient.delete(`/page_audio/${fileId}`)
}

export const fetchPageAudioFiles = async (pageId: string): Promise<PageAudioFile> => {
  const response = await mainFrontendClient.get(`page_audio/${pageId}/files`)
  return validateResponse(response, isPageAudioFile)
}
