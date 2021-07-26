import { NewPage, Page } from "../../../shared-module/bindings"
import { mainFrontendClient } from "../../mainFrontendClient"

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
