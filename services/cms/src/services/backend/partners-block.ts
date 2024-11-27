import { cmsClient } from "./cmsClient"

import { PartnersBlock } from "@/shared-module/common/bindings"
import { isPartnersBlock } from "@/shared-module/common/bindings.guard"
import { validateResponse } from "@/shared-module/common/utils/fetching"

export const setPartnerBlockForCourse = async (
  courseId: string,
  data: object | null,
): Promise<PartnersBlock> => {
  const response = await cmsClient.post(`/courses/${courseId}/partners-block`, data)
  return validateResponse(response, isPartnersBlock)
}

export const fetchPartnersBlock = async (courseId: string): Promise<PartnersBlock> => {
  const response = await cmsClient.get(`/courses/${courseId}/partners-block`)
  return validateResponse(response, isPartnersBlock)
}

export const deletePartnersBlock = async (courseId: string): Promise<void> => {
  await cmsClient.delete(`/courses/${courseId}/partners-block`)
}
