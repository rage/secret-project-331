import { CmsPageUpdate, ContentManagementPage } from "../../../shared-module/bindings"
import { isContentManagementPage } from "../../../shared-module/bindings.guard"
import { validateResponse } from "../../../shared-module/utils/fetching"
import { cmsClient } from "../cmsClient"

export const fetchPageWithId = async (pageId: string): Promise<ContentManagementPage> => {
  const response = await cmsClient.get(`/pages/${pageId}`, { responseType: "json" })
  return validateResponse(response, isContentManagementPage)
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
