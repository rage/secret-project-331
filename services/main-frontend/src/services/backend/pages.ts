import { isBoolean } from "lodash"

import { mainFrontendClient } from "../mainFrontendClient"

import {
  HistoryRestoreData,
  NewPage,
  Page,
  PageAudioFile,
  PageDetailsUpdate,
  PageHistory,
  PageInfo,
} from "@/shared-module/common/bindings"
import {
  isPage,
  isPageAudioFile,
  isPageHistory,
  isPageInfo,
} from "@/shared-module/common/bindings.guard"
import {
  isArray,
  isNumber,
  isString,
  validateResponse,
} from "@/shared-module/common/utils/fetching"

export const postNewPage = async (data: NewPage): Promise<Page> => {
  const response = await mainFrontendClient.post("/pages", data)
  return validateResponse(response, isPage)
}

export const deletePage = async (page_id: string): Promise<Page> => {
  const response = await mainFrontendClient.delete(`/pages/${page_id}`)
  return validateResponse(response, isPage)
}

export const fetchHistoryForPage = async (
  pageId: string,
  page: number,
  limit: number,
): Promise<Array<PageHistory>> => {
  const response = await mainFrontendClient.get(`/pages/${pageId}/history`, {
    params: { page, limit },
  })
  return validateResponse(response, isArray(isPageHistory))
}

export const fetchHistoryCountForPage = async (pageId: string): Promise<number> => {
  const response = await mainFrontendClient.get(`/pages/${pageId}/history_count`)
  return validateResponse(response, isNumber)
}

export const restorePage = async (pageId: string, historyId: string): Promise<string> => {
  const data: HistoryRestoreData = { history_id: historyId }
  const response = await mainFrontendClient.post(`/pages/${pageId}/restore`, data)
  return validateResponse(response, isString)
}

export const fetchPageInfo = async (pageId: string): Promise<PageInfo> => {
  const response = await mainFrontendClient.get(`/pages/${pageId}/info`)
  return validateResponse(response, isPageInfo)
}

export const fetchPageAudioFiles = async (pageId: string): Promise<PageAudioFile[]> => {
  const response = await mainFrontendClient.get(`/page_audio/${pageId}/files`)
  return validateResponse(response, isArray(isPageAudioFile))
}

export const updatePageDetails = async (pageId: string, data: PageDetailsUpdate): Promise<void> => {
  const response = await mainFrontendClient.put(`/pages/${pageId}/page-details`, data)
  validateResponse(response, isBoolean)
}

export const fetchAllPagesByCourseId = async (courseId: string): Promise<Page[]> => {
  const response = await mainFrontendClient.get(`/pages/${courseId}/all-course-pages-for-course`)
  return validateResponse(response, isArray(isPage))
}
