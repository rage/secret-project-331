import {
  CmsPageUpdate,
  ContentManagementPage,
  PageInfo,
  PageRoutingDataWithChapterStatus,
} from "../../shared-module/bindings"
import {
  isContentManagementPage,
  isPageInfo,
  isPageRoutingDataWithChapterStatus,
} from "../../shared-module/bindings.guard"
import { isNull, isUnion, validateResponse } from "../../shared-module/utils/fetching"

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
): Promise<PageRoutingDataWithChapterStatus | null> => {
  const response = await cmsClient.get(`/pages/${currentPageId}/next-page`)
  return validateResponse(response, isUnion(isPageRoutingDataWithChapterStatus, isNull))
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
