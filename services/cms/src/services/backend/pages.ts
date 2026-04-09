import { queryOptions } from "@tanstack/react-query"

import { cmsClient } from "./cmsClient"
import { parseCmsResponse } from "./parseCmsResponse"

import {
  type CmsPageUpdate,
  type ContentManagementPage,
  type PageInfo,
  type PageNavigationInformation,
} from "@/generated/api"
import { z } from "@/generated/api/zod"
import {
  zContentManagementPage,
  zPageInfo,
  zPageNavigationInformation,
} from "@/generated/api/zod.generated"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

export const fetchPageWithId = async (pageId: string): Promise<ContentManagementPage> => {
  const response = await cmsClient.get(`/pages/${pageId}`, { responseType: "json" })
  return parseCmsResponse(response, zContentManagementPage)
}

export const fetchPageInfo = async (pageId: string): Promise<PageInfo> => {
  const response = await cmsClient.get(`/pages/${pageId}/info`, { responseType: "json" })
  return parseCmsResponse(response, zPageInfo)
}

export const getPageInfoOptions = (pageId: string | null | undefined) =>
  queryOptions({
    queryKey: ["page-info", pageId],
    queryFn: () => fetchPageInfo(assertNotNullOrUndefined(pageId)),
  })

export const fetchNextPageRoutingData = async (
  currentPageId: string,
): Promise<PageNavigationInformation | null> => {
  const response = await cmsClient.get(`/pages/${currentPageId}/page-navigation`)
  return parseCmsResponse(response, z.nullable(zPageNavigationInformation))
}

export const updateExistingPage = async (
  page_id: string,
  data: CmsPageUpdate,
): Promise<ContentManagementPage> => {
  const response = await cmsClient.put(`/pages/${page_id}`, data, {
    headers: { "Content-Type": "application/json" },
  })
  return parseCmsResponse(response, zContentManagementPage)
}
