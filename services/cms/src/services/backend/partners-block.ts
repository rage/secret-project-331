import { cmsClient } from "./cmsClient"
import { parseCmsResponse } from "./parseCmsResponse"

import { type PartnersBlock } from "@/generated/api"
import { zPartnersBlock } from "@/generated/api/zod.generated"

export const setPartnerBlockForCourse = async (
  courseId: string,
  data: object | null,
): Promise<PartnersBlock> => {
  const response = await cmsClient.post(`/courses/${courseId}/partners-block`, data)
  return parseCmsResponse(response, zPartnersBlock)
}

export const fetchPartnersBlock = async (courseId: string): Promise<PartnersBlock> => {
  const response = await cmsClient.get(`/courses/${courseId}/partners-block`)
  return parseCmsResponse(response, zPartnersBlock)
}

export const deletePartnersBlock = async (courseId: string): Promise<void> => {
  await cmsClient.delete(`/courses/${courseId}/partners-block`)
}
