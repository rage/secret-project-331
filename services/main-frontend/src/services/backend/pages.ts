import { HistoryRestoreData, NewPage, Page, PageHistory } from "../../shared-module/bindings"
import { mainFrontendClient } from "../mainFrontendClient"

export const postNewPage = async (data: NewPage): Promise<Page> => {
  const response = await mainFrontendClient.post("/pages", data, {
    headers: { "Content-Type": "application/json" },
  })
  return response.data
}

export const deletePage = async (page_id: string): Promise<Page> => {
  const response = await mainFrontendClient.delete(`/pages/${page_id}`)
  return response.data
}

export const fetchHistoryForPage = async (
  pageId: string,
  page: number,
  limit: number,
): Promise<PageHistory[]> => {
  const response = await mainFrontendClient.get(`/pages/${pageId}/history`, {
    params: { page, limit },
  })
  return response.data
}

export const fetchHistoryCountForPage = async (pageId: string): Promise<number> => {
  const response = await mainFrontendClient.get(`/pages/${pageId}/history_count`)
  return response.data
}

export const restorePage = async (pageId: string, historyId: string): Promise<string> => {
  const data: HistoryRestoreData = { history_id: historyId }
  const response = await mainFrontendClient.post(`/pages/${pageId}/restore`, data, {
    headers: { "Content-Type": "application/json" },
  })
  return response.data
}
