import {
  CmsPageUpdate,
  ContentManagementPage,
  PageInfo,
  PageNavigationInformation,
} from "../../shared-module/common/bindings"
import {
  isContentManagementPage,
  isPageInfo,
  isPageNavigationInformation,
} from "../../shared-module/common/bindings.guard"
import { isNull, isUnion, validateResponse } from "../../shared-module/common/utils/fetching"

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
