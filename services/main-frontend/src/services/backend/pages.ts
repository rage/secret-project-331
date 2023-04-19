import {
  HistoryRestoreData,
  NewPage,
  Page,
  PageHistory,
  PageInfo,
} from "../../shared-module/bindings"
import { isPage, isPageHistory, isPageInfo } from "../../shared-module/bindings.guard"
import { isArray, isNumber, isString, validateResponse } from "../../shared-module/utils/fetching"
import { validateFile } from "../../shared-module/utils/files"
import { mainFrontendClient } from "../mainFrontendClient"

export const postNewPage = async (data: NewPage): Promise<Page> => {
  const response = await mainFrontendClient.post("/pages", data, {
    headers: { "Content-Type": "application/json" },
  })
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
  const response = await mainFrontendClient.post(`/pages/${pageId}/restore`, data, {
    headers: { "Content-Type": "application/json" },
  })
  return validateResponse(response, isString)
}

export const fetchPageInfo = async (pageId: string): Promise<PageInfo> => {
  const response = await mainFrontendClient.get(`/pages/${pageId}/info`, { responseType: "json" })
  return validateResponse(response, isPageInfo)
}

export const setPageAudio = async (pageId: string, file: File): Promise<Page> => {
  // eslint-disable-next-line i18next/no-literal-string
  validateFile(file, ["audio"])
  const data = new FormData()
  // eslint-disable-next-line i18next/no-literal-string
  data.append("file", file, file.name || "unknown")
  const response = await mainFrontendClient.put(`/pages/${pageId}/audio`, data)
  return validateResponse(response, isPage)
}

export const removePageAudio = async (pageId: string): Promise<void> => {
  await mainFrontendClient.delete(`pages/${pageId}/audio`)
}
