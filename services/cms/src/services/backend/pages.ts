import {
  CmsPageUpdate,
  ContentManagementPage,
  PageAudioFile,
  PageInfo,
  PageNavigationInformation,
} from "../../shared-module/bindings"
import {
  isContentManagementPage,
  isPageAudioFile,
  isPageInfo,
  isPageNavigationInformation,
} from "../../shared-module/bindings.guard"
import { isNull, isUnion, validateResponse } from "../../shared-module/utils/fetching"
import { validateFile } from "../../shared-module/utils/files"

import { cmsClient } from "./cmsClient"

export const fetchPageWithId = async (pageId: string): Promise<ContentManagementPage> => {
  const response = await cmsClient.get(`/pages/${pageId}`, { responseType: "json" })
  return validateResponse(response, isContentManagementPage)
}

export const fetchPageInfo = async (pageId: string): Promise<PageInfo> => {
  const response = await cmsClient.get(`/pages/${pageId}/info`, { responseType: "json" })
  return validateResponse(response, isPageInfo)
}

export const fetchNextPageRoutingData = async (
  currentPageId: string,
): Promise<PageNavigationInformation | null> => {
  const response = await cmsClient.get(`/pages/${currentPageId}/page-navigation`)
  return validateResponse(response, isUnion(isPageNavigationInformation, isNull))
}

export const updateExistingPage = async (
  page_id: string,
  data: CmsPageUpdate,
): Promise<ContentManagementPage> => {
  const response = await cmsClient.put(`/pages/${page_id}`, data, {
    headers: { "Content-Type": "application/json" },
  })
  return validateResponse(response, isContentManagementPage)
}

// Audio page endpoints

export const postPageAudioFile = async (pageId: string, file: File): Promise<PageAudioFile> => {
  // eslint-disable-next-line i18next/no-literal-string
  console.log("pageId", pageId, "file", file)
  validateFile(file, ["audio"])
  const data = new FormData()
  // eslint-disable-next-line i18next/no-literal-string
  data.append("file", file, file.name || "unknown")
  const response = await cmsClient.post(`/page_audio/${pageId}`, data)
  return validateResponse(response, isPageAudioFile)
}

export const removePageAudioFile = async (fileId: string): Promise<void> => {
  await cmsClient.delete(`page_audio/${fileId}`)
}

export const fetchPageAudioFiles = async (pageId: string): Promise<PageAudioFile> => {
  const response = await cmsClient.get(`page_audio/${pageId}`)
  return validateResponse(response, isPageAudioFile)
}
