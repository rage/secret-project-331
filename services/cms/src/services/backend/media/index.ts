import { RawAxiosRequestHeaders } from "axios"

import { cmsClient } from "../cmsClient"

import { MediaItem } from "./uploadMediaToServer"

export type MediaUploadType = { organizationId: string } | { courseId: string } | { examId: string }

export const uploadFileFromPage = async (
  file: File,
  uploadType: MediaUploadType,
): Promise<MediaItem> => {
  const data = new FormData()
  data.append("file", file, file.name || "unknown")

  // Override the default json value and include the file's mime type
  const headers: RawAxiosRequestHeaders = {
    "Content-Type": "multipart/form-data",
    "X-File-Type": file.type || "application/octet-stream",
  }

  if ("organizationId" in uploadType) {
    return (
      await cmsClient.post(`/organizations/${uploadType.organizationId}/upload`, data, { headers })
    ).data
  } else if ("courseId" in uploadType) {
    return (await cmsClient.post(`/courses/${uploadType.courseId}/upload`, data, { headers })).data
  } else if ("examId" in uploadType) {
    return (await cmsClient.post(`/exams/${uploadType.examId}/upload`, data, { headers })).data
  }
  assertExhaustive(uploadType)
}

function assertExhaustive(
  value: never,
  message = "Reached unexpected case in exhaustive switch",
): never {
  throw new Error(message)
}
