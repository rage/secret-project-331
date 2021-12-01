/* eslint-disable i18next/no-literal-string */
import { MediaItem } from "@wordpress/media-utils"

import { cmsClient } from "../cmsClient"

export type MediaUploadType = { organizationId: string } | { courseId: string } | { examId: string }

export const uploadFileFromPage = async (
  file: File,
  uploadType: MediaUploadType,
): Promise<MediaItem> => {
  const data = new FormData()
  data.append("file", file, file.name || "unknown")

  if ("organizationId" in uploadType) {
    return (await cmsClient.post(`/organizations/${uploadType.organizationId}/upload`, data)).data
  } else if ("courseId" in uploadType) {
    return (await cmsClient.post(`/courses/${uploadType.courseId}/upload`, data)).data
  } else if ("examId" in uploadType) {
    return (await cmsClient.post(`/exams/${uploadType.examId}/upload`, data)).data
  }
  assertExhaustive(uploadType)
}

function assertExhaustive(
  value: never,
  message = "Reached unexpected case in exhaustive switch",
): never {
  throw new Error(message)
}
