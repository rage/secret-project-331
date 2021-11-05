import { CmsPageUpdate, ContentManagementPage } from "../../../shared-module/bindings"
import { cmsClient } from "../cmsClient"

export const fetchPageWithId = async (pageId: string): Promise<ContentManagementPage> => {
  const data = (await cmsClient.get(`/pages/${pageId}`, { responseType: "json" })).data
  return data
}

export const updateExistingPage = async (
  page_id: string,
  data: CmsPageUpdate,
): Promise<ContentManagementPage> => {
  const response = await cmsClient.put(`/pages/${page_id}`, data, {
    headers: { "Content-Type": "application/json" },
  })
  return response.data
}
